package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/remote-sensing/sentinel-cli/internal/config"
	"github.com/remote-sensing/sentinel-cli/internal/crs"
	appio "github.com/remote-sensing/sentinel-cli/internal/io"
	"github.com/remote-sensing/sentinel-cli/internal/types"
	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
)

var (
	convertSourceEPSG  int
	convertTargetEPSG  int
	convertInputPath   string
	convertOutputPath  string
	convertRecursive   bool
	convertChunkSizeMB int
	convertSevenParams string
	convertNtv2Grid    string
)

var convertCmd = &cobra.Command{
	Use:   "convert",
	Short: "格式转换命令组 | Format conversion commands",
	Long: `格式转换命令组
Format conversion commands

包含坐标系统转换、格式转换等功能。
Includes CRS transformation, format conversion, etc.`,
}

var convertCRSCmd = &cobra.Command{
	Use:   "crs",
	Short: "坐标参考系统转换 | Coordinate Reference System transformation",
	Long: `坐标参考系统转换
Coordinate Reference System transformation

在不同坐标参考系统之间转换地理空间数据。
支持的基准面包括: WGS84 (EPSG:4326)、CGCS2000 (EPSG:4490)、
北京54 (EPSG:4214) 和 西安80 (EPSG:4610)。

支持两种转换方法:
1. Bursa-Wolf 七参数转换
2. NTv2 网格插值（在可用时提供更高精度）

Transform geospatial data between coordinate reference systems.
Supports common datums: WGS84 (EPSG:4326), CGCS2000 (EPSG:4490),
Beijing54 (EPSG:4214), and Xian80 (EPSG:4610).

Two transformation methods are supported:
1. Bursa-Wolf seven-parameter transformation
2. NTv2 grid interpolation (higher accuracy where available)`,
	Example: `  # 基本转换（使用默认参数）| Basic transformation (default parameters)
  sentinel convert crs --source-epsg 4326 --target-epsg 4490 -i input.tif -o output.tif

  # 使用自定义七参数转换 | Transform with custom seven parameters
  sentinel convert crs --source-epsg 4214 --target-epsg 4490 \
    --seven-params "-13.5,-129.5,-76.8,0,0,0,0" \
    -i /data/beijing54 -o /data/cgcs2000 -r

  # 使用 NTv2 网格进行高精度转换 | Use NTv2 grid for high-accuracy transformation
  sentinel convert crs --source-epsg 4326 --target-epsg 4490 \
    --ntv2-grid /path/to/china_geoid.gsb \
    -i input.tif -o output.tif

  # 递归处理目录并使用自定义块大小 | Process directory recursively with custom chunk size
  sentinel convert crs --source-epsg 4326 --target-epsg 4610 \
    -i /data/wgs84 -o /data/xian80 -r --chunk-size 128`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		if err := validateConvertCRSFlags(); err != nil {
			return err
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runConvertCRS()
	},
}

func init() {
	convertCmd.AddCommand(convertCRSCmd)
	rootCmd.AddCommand(convertCmd)

	convertCRSCmd.Flags().IntVar(&convertSourceEPSG, "source-epsg", 4326,
		"源EPSG代码 | Source EPSG code")
	convertCRSCmd.Flags().IntVar(&convertTargetEPSG, "target-epsg", 4490,
		"目标EPSG代码 | Target EPSG code")
	convertCRSCmd.Flags().StringVarP(&convertInputPath, "input", "i", "",
		"输入文件或目录路径 | Input file or directory path")
	convertCRSCmd.Flags().StringVarP(&convertOutputPath, "output", "o", "",
		"输出文件或目录路径 | Output file or directory path")
	convertCRSCmd.Flags().BoolVarP(&convertRecursive, "recursive", "r", false,
		"递归处理目录 | Process directories recursively")
	convertCRSCmd.Flags().IntVar(&convertChunkSizeMB, "chunk-size", 64,
		"处理时的块大小（MB） | Chunk size in MB for processing")
	convertCRSCmd.Flags().StringVar(&convertSevenParams, "seven-params", "",
		"Bursa-Wolf 七参数: dx,dy,dz,rx,ry,rz,scale（单位: dx/dy/dz为米, rx/ry/rz为弧秒, scale为ppm）| "+
			"Bursa-Wolf parameters: dx,dy,dz,rx,ry,rz,scale (units: meters for dx/dy/dz, arc-seconds for rx/ry/rz, ppm for scale)")
	convertCRSCmd.Flags().StringVar(&convertNtv2Grid, "ntv2-grid", "",
		"NTv2 网格文件路径 (.gsb)，用于高精度转换 | Path to NTv2 grid file (.gsb) for high-accuracy transformation")

	_ = convertCRSCmd.MarkFlagRequired("input")
	_ = convertCRSCmd.MarkFlagRequired("output")

	_ = convertCRSCmd.RegisterFlagCompletionFunc("source-epsg", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return []string{"4326\tWGS84", "4490\tCGCS2000", "4214\tBeijing54", "4610\tXian80"}, cobra.ShellCompDirectiveNoFileComp
	})
	_ = convertCRSCmd.RegisterFlagCompletionFunc("target-epsg", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return []string{"4326\tWGS84", "4490\tCGCS2000", "4214\tBeijing54", "4610\tXian80"}, cobra.ShellCompDirectiveNoFileComp
	})
}

func validateConvertCRSFlags() error {
	if !config.IsValidEPSG(convertSourceEPSG) {
		return apperrors.New(apperrors.E2001,
			fmt.Sprintf("无效的源EPSG代码: %d | Invalid source EPSG code: %d", convertSourceEPSG, convertSourceEPSG))
	}

	if !config.IsValidEPSG(convertTargetEPSG) {
		return apperrors.New(apperrors.E2001,
			fmt.Sprintf("无效的目标EPSG代码: %d | Invalid target EPSG code: %d", convertTargetEPSG, convertTargetEPSG))
	}

	if convertSourceEPSG == convertTargetEPSG {
		return apperrors.New(apperrors.E2001,
			fmt.Sprintf("源和目标EPSG相同 (%d)，无需转换 | Source and target EPSG are the same (%d), no transformation needed",
				convertSourceEPSG, convertSourceEPSG))
	}

	if err := validateInputPath(convertInputPath); err != nil {
		return err
	}

	if convertChunkSizeMB < 1 || convertChunkSizeMB > 512 {
		return apperrors.New(apperrors.E1003,
			fmt.Sprintf("块大小必须在 1-512 MB 之间，当前值: %d | Chunk size must be between 1 and 512 MB, current value: %d",
				convertChunkSizeMB, convertChunkSizeMB))
	}

	return nil
}

func parseSevenParams(paramStr string) (*types.SevenParams, error) {
	parts := strings.Split(paramStr, ",")
	if len(parts) != 7 {
		return nil, apperrors.New(apperrors.E2003,
			"七参数格式必须为: dx,dy,dz,rx,ry,rz,scale | Seven parameters must be in format: dx,dy,dz,rx,ry,rz,scale")
	}

	values := make([]float64, 7)
	for i, part := range parts {
		part = strings.TrimSpace(part)
		val, err := strconv.ParseFloat(part, 64)
		if err != nil {
			return nil, apperrors.New(apperrors.E2003,
				fmt.Sprintf("第 %d 个参数值无效: %s | Invalid parameter value at position %d: %s",
					i+1, part, i+1, part))
		}
		values[i] = val
	}

	return &types.SevenParams{
		DX: values[0],
		DY: values[1],
		DZ: values[2],
		RX: values[3],
		RY: values[4],
		RZ: values[5],
		DS: values[6],
	}, nil
}

func validateInputPath(path string) error {
	expandedPath := expandPath(path)
	info, err := os.Stat(expandedPath)
	if err != nil {
		if os.IsNotExist(err) {
			return apperrors.Wrap(err, apperrors.E4001,
				fmt.Sprintf("输入路径不存在: %s | Input path not found: %s", path, path))
		}
		return apperrors.Wrap(err, apperrors.E4001,
			fmt.Sprintf("无法访问输入路径: %s | Cannot access input path: %s", path, path))
	}

	file, err := os.Open(expandedPath)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E4001,
			fmt.Sprintf("输入路径不可读: %s | Input path is not readable: %s", path, path))
	}
	file.Close()

	if info.IsDir() {
		return nil
	}

	return nil
}

func expandPath(path string) string {
	if len(path) > 0 && path[0] == '~' {
		if home, err := os.UserHomeDir(); err == nil {
			path = filepath.Join(home, path[1:])
		}
	}
	return path
}

func runConvertCRS() error {
	transformConfig := types.CRSTransformConfig{
		SourceEPSG: convertSourceEPSG,
		TargetEPSG: convertTargetEPSG,
	}

	if convertSevenParams != "" {
		params, err := parseSevenParams(convertSevenParams)
		if err != nil {
			return err
		}
		transformConfig.SevenParams = params
	}

	if convertNtv2Grid != "" {
		transformConfig.NTv2Grid = &types.NTv2Grid{
			FilePath:   convertNtv2Grid,
			SourceEPSG: convertSourceEPSG,
			TargetEPSG: convertTargetEPSG,
		}
	}

	transformer, err := crs.NewCRSTransformer(transformConfig)
	if err != nil {
		return err
	}
	defer transformer.Close()

	inputInfo, err := os.Stat(expandPath(convertInputPath))
	if err != nil {
		return err
	}

	var files []string
	if inputInfo.IsDir() {
		files, err = appio.FindGeoTIFFFiles(convertInputPath, convertRecursive)
		if err != nil {
			return err
		}
		if len(files) == 0 {
			return apperrors.New(apperrors.E4001,
				fmt.Sprintf("目录中未找到GeoTIFF文件: %s | No GeoTIFF files found in directory: %s",
					convertInputPath, convertInputPath))
		}
	} else {
		files = []string{expandPath(convertInputPath)}
	}

	fmt.Printf("正在转换 %d 个文件，从 EPSG:%d 到 EPSG:%d\n",
		len(files), convertSourceEPSG, convertTargetEPSG)
	fmt.Printf("Transforming %d file(s) from EPSG:%d to EPSG:%d\n",
		len(files), convertSourceEPSG, convertTargetEPSG)
	fmt.Printf("源 | Source: %s\n", config.GetEPSGDescription(convertSourceEPSG))
	fmt.Printf("目标 | Target: %s\n", config.GetEPSGDescription(convertTargetEPSG))
	if transformConfig.SevenParams != nil {
		fmt.Printf("使用自定义七参数 | Using custom seven parameters\n")
	}
	if transformConfig.NTv2Grid != nil {
		fmt.Printf("使用 NTv2 网格 | Using NTv2 grid: %s\n", transformConfig.NTv2Grid.FilePath)
	}
	fmt.Println()

	successCount := 0
	failCount := 0

	for i, inputFile := range files {
		outputFile := generateOutputPath(inputFile, convertInputPath, convertOutputPath, inputInfo.IsDir())

		fmt.Printf("[%d/%d] 处理中 | Processing: %s\n", i+1, len(files), filepath.Base(inputFile))
		fmt.Printf("  输入 | Input:  %s\n", inputFile)
		fmt.Printf("  输出 | Output: %s\n", outputFile)

		if err := processFile(inputFile, outputFile, transformer, convertChunkSizeMB, convertTargetEPSG); err != nil {
			fmt.Printf("  错误 | Error: %v\n", err)
			failCount++
			continue
		}

		fmt.Printf("  成功 | Success\n")
		successCount++
	}

	fmt.Println()
	fmt.Printf("转换完成: %d 成功, %d 失败\n", successCount, failCount)
	fmt.Printf("Transformation complete: %d succeeded, %d failed\n", successCount, failCount)

	if failCount > 0 {
		return apperrors.New(apperrors.E7001,
			fmt.Sprintf("%d 个文件转换失败 | %d file(s) failed transformation", failCount, failCount))
	}

	return nil
}

func generateOutputPath(inputFile, inputPath, outputPath string, inputIsDir bool) string {
	expandedOutput := expandPath(outputPath)

	if !inputIsDir {
		outputInfo, err := os.Stat(expandedOutput)
		if err == nil && outputInfo.IsDir() {
			return filepath.Join(expandedOutput, filepath.Base(inputFile))
		}
		return expandedOutput
	}

	relPath, err := filepath.Rel(expandPath(inputPath), inputFile)
	if err != nil {
		return filepath.Join(expandedOutput, filepath.Base(inputFile))
	}
	return filepath.Join(expandedOutput, relPath)
}

func processFile(inputPath, outputPath string, transformer *crs.CRSTransformer, chunkSizeMB int, targetEPSG int) error {
	reader, err := appio.NewGeoTIFFReader(inputPath, chunkSizeMB)
	if err != nil {
		return err
	}
	defer reader.Close()

	metadata := reader.Metadata()
	metadata.EPSGCode = targetEPSG
	metadata.CRS = fmt.Sprintf("EPSG:%d", targetEPSG)

	newGT, bounds, err := transformer.TransformGeoTransform(metadata.GeoTransform, metadata.Width, metadata.Height)
	if err != nil {
		return err
	}
	metadata.GeoTransform = newGT
	metadata.Bounds = bounds

	writer, err := appio.NewGeoTIFFWriter(outputPath, metadata, chunkSizeMB)
	if err != nil {
		return err
	}
	defer writer.Close()

	iterator := reader.Iterator()
	for iterator.HasNext() {
		chunk, err := iterator.Next()
		if err != nil {
			return err
		}

		transformedChunk, err := transformer.TransformChunk(chunk, reader.Metadata())
		if err != nil {
			return err
		}

		if err := writer.WriteChunk(transformedChunk); err != nil {
			return err
		}
	}

	return nil
}
