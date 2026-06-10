package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	appio "github.com/remote-sensing/sentinel-cli/internal/io"
	"github.com/remote-sensing/sentinel-cli/internal/log"
	"github.com/remote-sensing/sentinel-cli/internal/types"
)

var (
	inspectInputPath   string
	inspectOutputPath  string
	inspectFormat      string
	inspectShowHistogram bool
	inspectShowBands   bool
)

var inspectCmd = &cobra.Command{
	Use:   "inspect",
	Short: "检查命令组 | Inspection commands",
	Long: `检查命令组
Inspection commands

包含 GeoTIFF 元数据检查、质量分析等功能。
Includes GeoTIFF metadata inspection, quality analysis, etc.`,
}

var inspectTileCmd = &cobra.Command{
	Use:   "tile",
	Short: "检查 GeoTIFF 瓦片元数据 | Inspect GeoTIFF tile metadata",
	Long: `检查 GeoTIFF 瓦片元数据
Inspect GeoTIFF tile metadata

输出 GeoTIFF 文件的详细元数据报告，包括投影信息、波段信息、
分辨率、尺寸、地理变换参数、NoData 值、直方图、文件指纹等。

Output detailed metadata report for GeoTIFF files, including projection
information, band details, resolution, dimensions, geotransform
parameters, NoData value, histogram, file fingerprint, etc.`,
	Example: `  # 基本检查，输出表格格式到控制台 | Basic inspection, table format to console
  sentinel inspect tile --input tile.tif

  # 输出 JSON 格式到文件 | Output JSON format to file
  sentinel inspect tile -i tile.tif -o report.json --format json

  # 显示直方图和波段详情 | Show histogram and band details
  sentinel inspect tile -i tile.tif --show-histogram --show-bands

  # 输出 Markdown 格式报告 | Output Markdown format report
  sentinel inspect tile -i tile.tif -o report.md --format markdown --show-histogram

  # 完整示例 | Full example
  sentinel inspect tile --input /data/sentinel2/tile.tif \
    --output /data/reports/tile_report.json \
    --format json --show-histogram --show-bands`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		if err := validateInspectTileFlags(); err != nil {
			return err
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runInspectTile()
	},
}

func init() {
	inspectCmd.AddCommand(inspectTileCmd)
	rootCmd.AddCommand(inspectCmd)

	inspectTileCmd.Flags().StringVarP(&inspectInputPath, "input", "i", "",
		"输入 GeoTIFF 文件路径 | Input GeoTIFF file path")
	inspectTileCmd.Flags().StringVarP(&inspectOutputPath, "output", "o", "",
		"输出报告文件路径（可选，默认输出到控制台）| Output report file path (optional, default to console)")
	inspectTileCmd.Flags().StringVar(&inspectFormat, "format", "table",
		"输出格式: table/json/markdown | Output format: table/json/markdown")
	inspectTileCmd.Flags().BoolVar(&inspectShowHistogram, "show-histogram", false,
		"显示波段直方图 | Show band histograms")
	inspectTileCmd.Flags().BoolVar(&inspectShowBands, "show-bands", false,
		"显示详细波段信息 | Show detailed band information")

	_ = inspectTileCmd.MarkFlagRequired("input")

	_ = inspectTileCmd.RegisterFlagCompletionFunc("format", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return []string{"table", "json", "markdown"}, cobra.ShellCompDirectiveNoFileComp
	})
}

func validateInspectTileFlags() error {
	if err := validateInputPath(inspectInputPath); err != nil {
		return err
	}

	info, err := os.Stat(expandPath(inspectInputPath))
	if err != nil {
		return err
	}
	if info.IsDir() {
		return apperrors.New(apperrors.E4001,
			fmt.Sprintf("输入路径必须是文件，不能是目录 | Input path must be a file, not a directory: %s", inspectInputPath))
	}

	inspectFormat = strings.ToLower(inspectFormat)
	validFormats := map[string]bool{"table": true, "json": true, "markdown": true}
	if !validFormats[inspectFormat] {
		return apperrors.New(apperrors.E5003,
			fmt.Sprintf("无效的输出格式: %s，必须是 table/json/markdown | Invalid output format: %s, must be table/json/markdown",
				inspectFormat, inspectFormat))
	}

	return nil
}

type TileReport struct {
	FilePath      string              `json:"file_path"`
	FileSize      int64               `json:"file_size"`
	FileSizeHuman string              `json:"file_size_human"`
	SHA256        string              `json:"sha256"`
	Projection    string              `json:"projection"`
	EPSGCode      int                 `json:"epsg_code"`
	Width         int                 `json:"width"`
	Height        int                 `json:"height"`
	ResolutionX   float64             `json:"resolution_x"`
	ResolutionY   float64             `json:"resolution_y"`
	GeoTransform  types.GeoTransform  `json:"geo_transform"`
	NumBands      int                 `json:"num_bands"`
	NoDataValue   *float64            `json:"no_data_value,omitempty"`
	DataType      string              `json:"data_type"`
	Compression   string              `json:"compression"`
	Bands         []BandReport        `json:"bands,omitempty"`
	GeneratedAt   string              `json:"generated_at"`
}

type BandReport struct {
	Index        int      `json:"index"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	DataType     string   `json:"data_type"`
	NoDataValue  *float64 `json:"no_data_value,omitempty"`
	MinValue     float64  `json:"min_value"`
	MaxValue     float64  `json:"max_value"`
	MeanValue    float64  `json:"mean_value"`
	StdDev       float64  `json:"std_dev"`
	WavelengthMin float64 `json:"wavelength_min,omitempty"`
	WavelengthMax float64 `json:"wavelength_max,omitempty"`
	Histogram    []uint64 `json:"histogram,omitempty"`
}

func runInspectTile() error {
	inputPath := expandPath(inspectInputPath)

	metadata, err := appio.ReadMetadata(inputPath)
	if err != nil {
		return err
	}

	sha256, err := log.ComputeFileSHA256(inputPath)
	if err != nil {
		return err
	}

	reader, err := appio.NewGeoTIFFReader(inputPath, 64)
	if err != nil {
		return err
	}
	defer reader.Close()

	var allData []float64
	iterator := reader.Iterator()
	for iterator.HasNext() {
		chunk, err := iterator.Next()
		if err != nil {
			return err
		}
		if bandData, ok := chunk.Data.([][]float64); ok && len(bandData) > 0 {
			allData = append(allData, bandData[0]...)
		}
	}

	var noDataVal *float64
	if detected, ok := appio.DetectNoData(allData, 10000); ok {
		noDataVal = &detected
	}

	bandReports := make([]BandReport, 0)
	if inspectShowBands {
		for i, band := range metadata.Bands {
			bandReport := BandReport{
				Index:       band.Index,
				Name:        band.Name,
				Description: band.Description,
				DataType:    band.DataType,
				NoDataValue: band.NoDataValue,
				MinValue:    band.MinValue,
				MaxValue:    band.MaxValue,
				MeanValue:   band.MeanValue,
				StdDev:      band.StdDev,
			}

			if preset, ok := AppConfig.Sensors[string(metadata.SensorType)]; ok {
				for bandName, spec := range preset.Bands {
					if spec.Index == band.Index {
						bandReport.WavelengthMin = spec.WavelengthMin
						bandReport.WavelengthMax = spec.WavelengthMax
						if bandReport.Name == fmt.Sprintf("Band %d", band.Index) {
							bandReport.Name = bandName
						}
						break
					}
				}
			}

			if inspectShowHistogram {
				if len(allData) > 0 {
					hist, _ := appio.CalculateHistogram(allData, 256, band.MinValue, band.MaxValue)
					bandReport.Histogram = hist
				} else if len(band.Histogram) > 0 {
					bandReport.Histogram = band.Histogram
				}
			}

			bandReports = append(bandReports, bandReport)
			_ = i
		}
	}

	report := TileReport{
		FilePath:      inputPath,
		FileSize:      metadata.FileSize,
		FileSizeHuman: formatFileSize(metadata.FileSize),
		SHA256:        sha256,
		Projection:    metadata.CRS,
		EPSGCode:      metadata.EPSGCode,
		Width:         metadata.Width,
		Height:        metadata.Height,
		ResolutionX:   metadata.PixelSizeX,
		ResolutionY:   metadata.PixelSizeY,
		GeoTransform:  metadata.GeoTransform,
		NumBands:      metadata.NumBands,
		NoDataValue:   noDataVal,
		DataType:      metadata.DataType,
		Compression:   metadata.Compression,
		Bands:         bandReports,
		GeneratedAt:   "2026-06-11T00:00:00Z",
	}

	var output string
	switch inspectFormat {
	case "json":
		output, err = formatJSON(report)
	case "markdown":
		output, err = formatMarkdown(report)
	default:
		output, err = formatTable(report)
	}
	if err != nil {
		return err
	}

	if inspectOutputPath != "" {
		outputPath := expandPath(inspectOutputPath)
		dir := filepath.Dir(outputPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return apperrors.Wrap(err, apperrors.E1005,
				fmt.Sprintf("无法创建输出目录 | Cannot create output directory: %s", dir))
		}
		if err := os.WriteFile(outputPath, []byte(output), 0644); err != nil {
			return apperrors.Wrap(err, apperrors.E1005,
				fmt.Sprintf("无法写入报告文件 | Cannot write report file: %s", outputPath))
		}
		fmt.Printf("报告已写入 | Report written to: %s\n", outputPath)
	} else {
		fmt.Println(output)
	}

	return nil
}

func formatFileSize(size int64) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}
	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.2f %cB", float64(size)/float64(div), "KMGTPE"[exp])
}

func formatJSON(report TileReport) (string, error) {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", apperrors.Wrap(err, apperrors.E3002, "无法序列化报告为 JSON | Cannot serialize report to JSON")
	}
	return string(data), nil
}

func formatTable(report TileReport) (string, error) {
	var sb strings.Builder

	sb.WriteString("╔══════════════════════════════════════════════════════════════╗\n")
	sb.WriteString("║                GeoTIFF 元数据报告 | Metadata Report         ║\n")
	sb.WriteString("╠══════════════════════════════════════════════════════════════╣\n")
	sb.WriteString(fmt.Sprintf("║ %-28s %-31s ║\n", "文件路径 | File:", truncateString(report.FilePath, 31)))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31s ║\n", "文件大小 | Size:", report.FileSizeHuman))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31s ║\n", "SHA256 指纹 | SHA256:", truncateString(report.SHA256, 31)))
	sb.WriteString("╠══════════════════════════════════════════════════════════════╣\n")
	sb.WriteString("║                      投影信息 | Projection                   ║\n")
	sb.WriteString("╠══════════════════════════════════════════════════════════════╣\n")
	sb.WriteString(fmt.Sprintf("║ %-28s %-31s ║\n", "投影 | Projection:", report.Projection))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31d ║\n", "EPSG 代码 | EPSG Code:", report.EPSGCode))
	sb.WriteString("╠══════════════════════════════════════════════════════════════╣\n")
	sb.WriteString("║                       尺寸信息 | Dimensions                  ║\n")
	sb.WriteString("╠══════════════════════════════════════════════════════════════╣\n")
	sb.WriteString(fmt.Sprintf("║ %-28s %-31d ║\n", "宽度 | Width (px):", report.Width))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31d ║\n", "高度 | Height (px):", report.Height))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31.4f ║\n", "X 分辨率 | Resolution X:", report.ResolutionX))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31.4f ║\n", "Y 分辨率 | Resolution Y:", report.ResolutionY))
	sb.WriteString("╠══════════════════════════════════════════════════════════════╣\n")
	sb.WriteString("║                    地理变换 | GeoTransform                   ║\n")
	sb.WriteString("╠══════════════════════════════════════════════════════════════╣\n")
	sb.WriteString(fmt.Sprintf("║ %-28s %-31.4f ║\n", "原点 X | Origin X:", report.GeoTransform.OriginX))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31.4f ║\n", "原点 Y | Origin Y:", report.GeoTransform.OriginY))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31.4f ║\n", "像素宽度 | Pixel Width:", report.GeoTransform.PixelWidth))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31.4f ║\n", "像素高度 | Pixel Height:", report.GeoTransform.PixelHeight))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31.4f ║\n", "旋转 X | Rotation X:", report.GeoTransform.RotationX))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31.4f ║\n", "旋转 Y | Rotation Y:", report.GeoTransform.RotationY))
	sb.WriteString("╠══════════════════════════════════════════════════════════════╣\n")
	sb.WriteString("║                      波段信息 | Bands                        ║\n")
	sb.WriteString("╠══════════════════════════════════════════════════════════════╣\n")
	sb.WriteString(fmt.Sprintf("║ %-28s %-31d ║\n", "波段数量 | Band Count:", report.NumBands))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31s ║\n", "数据类型 | Data Type:", report.DataType))
	sb.WriteString(fmt.Sprintf("║ %-28s %-31s ║\n", "压缩方式 | Compression:", report.Compression))
	noDataStr := "未检测到 | Not detected"
	if report.NoDataValue != nil {
		noDataStr = fmt.Sprintf("%.4f", *report.NoDataValue)
	}
	sb.WriteString(fmt.Sprintf("║ %-28s %-31s ║\n", "NoData 值 | NoData Value:", noDataStr))

	if inspectShowBands && len(report.Bands) > 0 {
		for _, band := range report.Bands {
			sb.WriteString("╠══════════════════════════════════════════════════════════════╣\n")
			sb.WriteString(fmt.Sprintf("║                   波段 %d | Band %d                          ║\n", band.Index, band.Index))
			sb.WriteString("╠══════════════════════════════════════════════════════════════╣\n")
			sb.WriteString(fmt.Sprintf("║ %-28s %-31s ║\n", "名称 | Name:", band.Name))
			sb.WriteString(fmt.Sprintf("║ %-28s %-31s ║\n", "描述 | Description:", truncateString(band.Description, 31)))
			sb.WriteString(fmt.Sprintf("║ %-28s %-31s ║\n", "数据类型 | Data Type:", band.DataType))
			sb.WriteString(fmt.Sprintf("║ %-28s %-31.4f ║\n", "最小值 | Min Value:", band.MinValue))
			sb.WriteString(fmt.Sprintf("║ %-28s %-31.4f ║\n", "最大值 | Max Value:", band.MaxValue))
			sb.WriteString(fmt.Sprintf("║ %-28s %-31.4f ║\n", "平均值 | Mean Value:", band.MeanValue))
			sb.WriteString(fmt.Sprintf("║ %-28s %-31.4f ║\n", "标准差 | Std Dev:", band.StdDev))
			if band.WavelengthMin > 0 || band.WavelengthMax > 0 {
				sb.WriteString(fmt.Sprintf("║ %-28s %.2f - %.2f nm             ║\n", "波长 | Wavelength:", band.WavelengthMin, band.WavelengthMax))
			}
			if inspectShowHistogram && len(band.Histogram) > 0 {
				sb.WriteString("║                                                              ║\n")
				sb.WriteString("║ 直方图 | Histogram:                                          ║\n")
				sb.WriteString(formatHistogramASCII(band.Histogram, 60))
			}
		}
	}

	sb.WriteString("╚══════════════════════════════════════════════════════════════╝\n")

	return sb.String(), nil
}

func formatMarkdown(report TileReport) (string, error) {
	var sb strings.Builder

	sb.WriteString("# GeoTIFF 元数据报告 | Metadata Report\n\n")
	sb.WriteString(fmt.Sprintf("**生成时间 | Generated:** %s\n\n", report.GeneratedAt))

	sb.WriteString("## 基本信息 | Basic Information\n\n")
	sb.WriteString("| 属性 | Property | 值 | Value |\n")
	sb.WriteString("| --- | --- | --- | --- |\n")
	sb.WriteString(fmt.Sprintf("| 文件路径 | File Path | `%s` |\n", report.FilePath))
	sb.WriteString(fmt.Sprintf("| 文件大小 | File Size | %s (%d bytes) |\n", report.FileSizeHuman, report.FileSize))
	sb.WriteString(fmt.Sprintf("| SHA256 指纹 | SHA256 | `%s` |\n", report.SHA256))

	sb.WriteString("\n## 投影信息 | Projection\n\n")
	sb.WriteString("| 属性 | Property | 值 | Value |\n")
	sb.WriteString("| --- | --- | --- | --- |\n")
	sb.WriteString(fmt.Sprintf("| 投影 | Projection | %s |\n", report.Projection))
	sb.WriteString(fmt.Sprintf("| EPSG 代码 | EPSG Code | %d |\n", report.EPSGCode))

	sb.WriteString("\n## 尺寸信息 | Dimensions\n\n")
	sb.WriteString("| 属性 | Property | 值 | Value |\n")
	sb.WriteString("| --- | --- | --- | --- |\n")
	sb.WriteString(fmt.Sprintf("| 宽度 | Width | %d px |\n", report.Width))
	sb.WriteString(fmt.Sprintf("| 高度 | Height | %d px |\n", report.Height))
	sb.WriteString(fmt.Sprintf("| X 分辨率 | Resolution X | %.4f |\n", report.ResolutionX))
	sb.WriteString(fmt.Sprintf("| Y 分辨率 | Resolution Y | %.4f |\n", report.ResolutionY))

	sb.WriteString("\n## 地理变换 | GeoTransform\n\n")
	sb.WriteString("| 属性 | Property | 值 | Value |\n")
	sb.WriteString("| --- | --- | --- | --- |\n")
	sb.WriteString(fmt.Sprintf("| 原点 X | Origin X | %.4f |\n", report.GeoTransform.OriginX))
	sb.WriteString(fmt.Sprintf("| 原点 Y | Origin Y | %.4f |\n", report.GeoTransform.OriginY))
	sb.WriteString(fmt.Sprintf("| 像素宽度 | Pixel Width | %.4f |\n", report.GeoTransform.PixelWidth))
	sb.WriteString(fmt.Sprintf("| 像素高度 | Pixel Height | %.4f |\n", report.GeoTransform.PixelHeight))
	sb.WriteString(fmt.Sprintf("| 旋转 X | Rotation X | %.4f |\n", report.GeoTransform.RotationX))
	sb.WriteString(fmt.Sprintf("| 旋转 Y | Rotation Y | %.4f |\n", report.GeoTransform.RotationY))

	sb.WriteString("\n## 波段信息 | Bands\n\n")
	sb.WriteString("| 属性 | Property | 值 | Value |\n")
	sb.WriteString("| --- | --- | --- | --- |\n")
	sb.WriteString(fmt.Sprintf("| 波段数量 | Band Count | %d |\n", report.NumBands))
	sb.WriteString(fmt.Sprintf("| 数据类型 | Data Type | %s |\n", report.DataType))
	sb.WriteString(fmt.Sprintf("| 压缩方式 | Compression | %s |\n", report.Compression))
	noDataStr := "未检测到 | Not detected"
	if report.NoDataValue != nil {
		noDataStr = fmt.Sprintf("%.4f", *report.NoDataValue)
	}
	sb.WriteString(fmt.Sprintf("| NoData 值 | NoData Value | %s |\n", noDataStr))

	if inspectShowBands && len(report.Bands) > 0 {
		for _, band := range report.Bands {
			sb.WriteString(fmt.Sprintf("\n### 波段 %d | Band %d: %s\n\n", band.Index, band.Index, band.Name))
			sb.WriteString("| 属性 | Property | 值 | Value |\n")
			sb.WriteString("| --- | --- | --- | --- |\n")
			sb.WriteString(fmt.Sprintf("| 名称 | Name | %s |\n", band.Name))
			sb.WriteString(fmt.Sprintf("| 描述 | Description | %s |\n", band.Description))
			sb.WriteString(fmt.Sprintf("| 数据类型 | Data Type | %s |\n", band.DataType))
			sb.WriteString(fmt.Sprintf("| 最小值 | Min Value | %.4f |\n", band.MinValue))
			sb.WriteString(fmt.Sprintf("| 最大值 | Max Value | %.4f |\n", band.MaxValue))
			sb.WriteString(fmt.Sprintf("| 平均值 | Mean Value | %.4f |\n", band.MeanValue))
			sb.WriteString(fmt.Sprintf("| 标准差 | Std Dev | %.4f |\n", band.StdDev))
			if band.WavelengthMin > 0 || band.WavelengthMax > 0 {
				sb.WriteString(fmt.Sprintf("| 波长 | Wavelength | %.2f - %.2f nm |\n", band.WavelengthMin, band.WavelengthMax))
			}
			if inspectShowHistogram && len(band.Histogram) > 0 {
				sb.WriteString("\n**直方图 | Histogram:**\n\n")
				sb.WriteString("```\n")
				sb.WriteString(formatHistogramASCII(band.Histogram, 70))
				sb.WriteString("```\n")
			}
		}
	}

	return sb.String(), nil
}

func formatHistogramASCII(hist []uint64, maxWidth int) string {
	if len(hist) == 0 {
		return ""
	}

	var maxVal uint64 = 0
	for _, v := range hist {
		if v > maxVal {
			maxVal = v
		}
	}
	if maxVal == 0 {
		maxVal = 1
	}

	var sb strings.Builder
	numBars := len(hist)
	if numBars > 32 {
		numBars = 32
	}
	step := len(hist) / numBars
	if step < 1 {
		step = 1
	}

	for i := 0; i < numBars; i++ {
		idx := i * step
		if idx >= len(hist) {
			break
		}
		barLen := int(float64(hist[idx]) / float64(maxVal) * float64(maxWidth))
		if barLen < 1 && hist[idx] > 0 {
			barLen = 1
		}
		bar := strings.Repeat("█", barLen)
		sb.WriteString(fmt.Sprintf("║ %4d: %-60s %8d ║\n", i, bar, hist[idx]))
	}

	return sb.String()
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return s[:maxLen]
	}
	return s[:maxLen-3] + "..."
}
