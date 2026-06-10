package cmd

import (
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/remote-sensing/sentinel-cli/internal/config"
	appio "github.com/remote-sensing/sentinel-cli/internal/io"
	"github.com/remote-sensing/sentinel-cli/internal/types"
	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
)

var (
	indexInputPath     string
	indexOutputPath    string
	indexRecursive     bool
	indexChunkSizeMB   int
	indexSensor        string
	indexNoData        float64
	indexCustomFormula string
)

var indexCmd = &cobra.Command{
	Use:   "index",
	Short: "植被指数计算命令组 | Vegetation index calculation commands",
	Long: `植被指数计算命令组
Vegetation index calculation commands

包含 NDVI、EVI、SAVI 等常用植被指数的计算功能，支持自定义公式。
Includes calculation of common vegetation indices such as NDVI, EVI, SAVI, and custom formulas.

支持的传感器类型：
  - Sentinel-2 MSI (sentinel2)
  - Landsat-8 OLI/TIRS (landsat8)
  - Gaofen-2 PMS (gf2)

Supported sensor types:
  - Sentinel-2 MSI (sentinel2)
  - Landsat-8 OLI/TIRS (landsat8)
  - Gaofen-2 PMS (gf2)`,
	Example: `  # 计算 Sentinel-2 影像的 NDVI 指数 | Calculate NDVI index for Sentinel-2 imagery
  sentinel index ndvi -i input.tif -o output.tif

  # 计算 Landsat-8 影像的 EVI 指数，指定传感器类型 | Calculate EVI index for Landsat-8 imagery, specify sensor type
  sentinel index evi -i input.tif -o output.tif --sensor landsat8

  # 递归处理目录，计算 GF-2 影像的 SAVI 指数 | Process directory recursively, calculate SAVI index for GF-2 imagery
  sentinel index savi -i /data/gf2 -o /data/output -r --sensor gf2

  # 使用自定义公式计算植被指数 | Calculate vegetation index using custom formula
  sentinel index ndvi -i input.tif -o output.tif --custom-formula "(B8 - B4) / (B8 + B4)"

  # 指定 NoData 值和块大小 | Specify NoData value and chunk size
  sentinel index ndvi -i input.tif -o output.tif --nodata -9999 --chunk-size 128`,
}

var ndviCmd = &cobra.Command{
	Use:   "ndvi",
	Short: "计算归一化植被指数 (NDVI) | Calculate Normalized Difference Vegetation Index (NDVI)",
	Long: `计算归一化植被指数 (NDVI)
Calculate Normalized Difference Vegetation Index (NDVI)

NDVI = (NIR - Red) / (NIR + Red)

NDVI 是最常用的植被指数，用于评估植被绿度和覆盖度。
NDVI is the most commonly used vegetation index for assessing vegetation greenness and coverage.

取值范围: -1 到 1
  - 负值: 水体、云、雪等
  - 0-0.2: 裸土、岩石
  - 0.2-0.5: 稀疏植被、农田
  - 0.5-1.0: 茂密植被、森林

Value range: -1 to 1
  - Negative: water, clouds, snow, etc.
  - 0-0.2: bare soil, rock
  - 0.2-0.5: sparse vegetation, farmland
  - 0.5-1.0: dense vegetation, forest`,
	Example: `  # 基本 NDVI 计算（自动检测传感器）| Basic NDVI calculation (auto-detect sensor)
  sentinel index ndvi -i sentinel2_image.tif -o ndvi_output.tif

  # 指定传感器类型为 Landsat-8 | Specify sensor type as Landsat-8
  sentinel index ndvi -i landsat8_image.tif -o ndvi_output.tif --sensor landsat8

  # 递归处理目录 | Process directory recursively
  sentinel index ndvi -i /data/input -o /data/output -r`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return validateIndexFlags("ndvi")
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runIndexCalculation("ndvi")
	},
}

var eviCmd = &cobra.Command{
	Use:   "evi",
	Short: "计算增强型植被指数 (EVI) | Calculate Enhanced Vegetation Index (EVI)",
	Long: `计算增强型植被指数 (EVI)
Calculate Enhanced Vegetation Index (EVI)

EVI = 2.5 * (NIR - Red) / (NIR + 6 * Red - 7.5 * Blue + 1)

EVI 通过引入蓝光波段修正大气气溶胶和土壤背景的影响，
对高植被覆盖区比 NDVI 更敏感。
EVI corrects for atmospheric aerosol and soil background effects by introducing the blue band,
and is more sensitive than NDVI in areas with high vegetation coverage.

取值范围: -1 到 1
Value range: -1 to 1`,
	Example: `  # 基本 EVI 计算 | Basic EVI calculation
  sentinel index evi -i sentinel2_image.tif -o evi_output.tif

  # 指定传感器类型为 GF-2 | Specify sensor type as GF-2
  sentinel index evi -i gf2_image.tif -o evi_output.tif --sensor gf2

  # 使用自定义 NoData 值 | Use custom NoData value
  sentinel index evi -i input.tif -o output.tif --nodata -9999`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return validateIndexFlags("evi")
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runIndexCalculation("evi")
	},
}

var saviCmd = &cobra.Command{
	Use:   "savi",
	Short: "计算土壤调整植被指数 (SAVI) | Calculate Soil-Adjusted Vegetation Index (SAVI)",
	Long: `计算土壤调整植被指数 (SAVI)
Calculate Soil-Adjusted Vegetation Index (SAVI)

SAVI = ((NIR - Red) / (NIR + Red + 0.5)) * 1.5

SAVI 通过引入土壤调整系数 L=0.5，减少土壤背景对植被指数的影响，
特别适用于植被覆盖度较低的区域。
SAVI reduces the influence of soil background on vegetation index by introducing a soil adjustment factor L=0.5,
and is particularly suitable for areas with low vegetation coverage.

取值范围: -1 到 1
Value range: -1 to 1`,
	Example: `  # 基本 SAVI 计算 | Basic SAVI calculation
  sentinel index savi -i sentinel2_image.tif -o savi_output.tif

  # 递归处理目录并指定块大小 | Process directory recursively and specify chunk size
  sentinel index savi -i /data/input -o /data/output -r --chunk-size 128

  # 使用自定义公式覆盖默认 SAVI 公式 | Override default SAVI formula with custom formula
  sentinel index savi -i input.tif -o output.tif --custom-formula "((B8 - B4) / (B8 + B4 + 0.25)) * 1.25"`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return validateIndexFlags("savi")
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runIndexCalculation("savi")
	},
}

func init() {
	rootCmd.AddCommand(indexCmd)
	indexCmd.AddCommand(ndviCmd)
	indexCmd.AddCommand(eviCmd)
	indexCmd.AddCommand(saviCmd)

	for _, cmd := range []*cobra.Command{ndviCmd, eviCmd, saviCmd} {
		cmd.Flags().StringVarP(&indexInputPath, "input", "i", "",
			"输入文件或目录路径 | Input file or directory path")
		cmd.Flags().StringVarP(&indexOutputPath, "output", "o", "",
			"输出文件或目录路径 | Output file or directory path")
		cmd.Flags().BoolVarP(&indexRecursive, "recursive", "r", false,
			"递归处理目录 | Process directories recursively")
		cmd.Flags().IntVar(&indexChunkSizeMB, "chunk-size", 64,
			"处理时的块大小（MB）| Chunk size in MB for processing")
		cmd.Flags().StringVar(&indexSensor, "sensor", "auto-detect",
			"传感器类型 (auto-detect/sentinel2/landsat8/gf2) | Sensor type (auto-detect/sentinel2/landsat8/gf2)")
		cmd.Flags().Float64Var(&indexNoData, "nodata", 0,
			"输出 NoData 值 | Output NoData value")
		cmd.Flags().StringVar(&indexCustomFormula, "custom-formula", "",
			"自定义计算公式，如 (B8-B4)/(B8+B4) | Custom calculation formula, e.g., (B8-B4)/(B8+B4)")

		_ = cmd.MarkFlagRequired("input")
		_ = cmd.MarkFlagRequired("output")

		_ = cmd.RegisterFlagCompletionFunc("sensor", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			return []string{"auto-detect", "sentinel2\tSentinel-2 MSI", "landsat8\tLandsat-8 OLI/TIRS", "gf2\tGaofen-2 PMS"}, cobra.ShellCompDirectiveNoFileComp
		})
	}
}

func validateIndexFlags(indexType string) error {
	validSensors := map[string]bool{
		"auto-detect": true,
		"sentinel2":   true,
		"landsat8":    true,
		"gf2":         true,
	}

	if !validSensors[strings.ToLower(indexSensor)] {
		return apperrors.New(apperrors.E2001,
			fmt.Sprintf("无效的传感器类型: %s | Invalid sensor type: %s", indexSensor, indexSensor))
	}

	if err := validateInputPath(indexInputPath); err != nil {
		return err
	}

	if indexChunkSizeMB < 1 || indexChunkSizeMB > 512 {
		return apperrors.New(apperrors.E1003,
			fmt.Sprintf("块大小必须在 1-512 MB 之间，当前值: %d | Chunk size must be between 1 and 512 MB, current value: %d",
				indexChunkSizeMB, indexChunkSizeMB))
	}

	return nil
}

func detectSensorType(meta *types.GeoTIFFMetadata) types.SensorType {
	if meta.SensorType != "" && meta.SensorType != types.SensorUnknown {
		return meta.SensorType
	}

	metadata := map[string]string{
		"sensor":   string(meta.SensorType),
		"platform": string(meta.SensorType),
	}

	for _, band := range meta.Bands {
		metadata[fmt.Sprintf("band_%d", band.Index)] = band.Name
	}

	detected := config.DetectSensorType(metadata)
	if detected != types.SensorUnknown {
		return detected
	}

	return meta.SensorType
}

func getSensorType(meta *types.GeoTIFFMetadata) (types.SensorType, error) {
	if strings.ToLower(indexSensor) != "auto-detect" {
		sensorType := types.SensorType(strings.ToLower(indexSensor))
		preset, ok := config.GetSensorPreset(sensorType)
		if !ok {
			return "", apperrors.New(apperrors.E2001,
				fmt.Sprintf("未找到传感器预设: %s | Sensor preset not found: %s", indexSensor, indexSensor))
		}
		fmt.Printf("使用指定传感器: %s (%s)\n", preset.Name, sensorType)
		fmt.Printf("Using specified sensor: %s (%s)\n", preset.Name, sensorType)
		return sensorType, nil
	}

	detected := detectSensorType(meta)
	if detected == types.SensorUnknown {
		fmt.Printf("警告: 无法自动检测传感器类型，默认使用 Sentinel-2\n")
		fmt.Printf("Warning: Cannot auto-detect sensor type, defaulting to Sentinel-2\n")
		return types.SensorSentinel2, nil
	}

	preset, ok := config.GetSensorPreset(detected)
	if ok {
		fmt.Printf("自动检测到传感器: %s (%s)\n", preset.Name, detected)
		fmt.Printf("Auto-detected sensor: %s (%s)\n", preset.Name, detected)
	}
	return detected, nil
}

func getFormula(sensorType types.SensorType, indexType string) (string, error) {
	if indexCustomFormula != "" {
		validation := config.ValidateBandCombination(sensorType, indexCustomFormula)
		if !validation.Valid {
			var errMsgs []string
			for _, e := range validation.Errors {
				errMsgs = append(errMsgs, fmt.Sprintf("  - %s: %s", e.Field, e.Message))
			}
			return "", apperrors.New(apperrors.E1003,
				fmt.Sprintf("自定义公式验证失败 | Custom formula validation failed:\n%s", strings.Join(errMsgs, "\n")))
		}
		fmt.Printf("使用自定义公式: %s\n", indexCustomFormula)
		fmt.Printf("Using custom formula: %s\n", indexCustomFormula)
		return indexCustomFormula, nil
	}

	formula, ok := config.GetIndexFormula(sensorType, indexType)
	if !ok {
		return "", apperrors.New(apperrors.E2001,
			fmt.Sprintf("未找到传感器 %s 的 %s 公式 | Formula for %s not found for sensor %s",
				sensorType, strings.ToUpper(indexType), strings.ToUpper(indexType), sensorType))
	}

	preset, _ := config.GetSensorPreset(sensorType)
	fmt.Printf("使用 %s 默认公式: %s\n", preset.Name, formula)
	fmt.Printf("Using %s default formula: %s\n", preset.Name, formula)

	validation := config.ValidateBandCombination(sensorType, formula)
	if !validation.Valid {
		var errMsgs []string
		for _, e := range validation.Errors {
			errMsgs = append(errMsgs, fmt.Sprintf("  - %s: %s", e.Field, e.Message))
		}
		return "", apperrors.New(apperrors.E1003,
			fmt.Sprintf("公式波段验证失败 | Formula band validation failed:\n%s", strings.Join(errMsgs, "\n")))
	}

	return formula, nil
}

func runIndexCalculation(indexType string) error {
	inputInfo, err := os.Stat(expandPath(indexInputPath))
	if err != nil {
		return err
	}

	var files []string
	if inputInfo.IsDir() {
		files, err = appio.FindGeoTIFFFiles(indexInputPath, indexRecursive)
		if err != nil {
			return err
		}
		if len(files) == 0 {
			return apperrors.New(apperrors.E4001,
				fmt.Sprintf("目录中未找到GeoTIFF文件: %s | No GeoTIFF files found in directory: %s",
					indexInputPath, indexInputPath))
		}
	} else {
		files = []string{expandPath(indexInputPath)}
	}

	fmt.Printf("正在计算 %d 个文件的 %s 指数\n", len(files), strings.ToUpper(indexType))
	fmt.Printf("Calculating %s index for %d file(s)\n", strings.ToUpper(indexType), len(files))
	fmt.Printf("NoData 值 | NoData value: %.0f\n", indexNoData)
	fmt.Printf("块大小 | Chunk size: %d MB\n", indexChunkSizeMB)
	fmt.Println()

	successCount := 0
	failCount := 0

	for i, inputFile := range files {
		outputFile := generateIndexOutputPath(inputFile, indexInputPath, indexOutputPath, inputInfo.IsDir(), indexType)

		fmt.Printf("[%d/%d] 处理中 | Processing: %s\n", i+1, len(files), filepath.Base(inputFile))
		fmt.Printf("  输入 | Input:  %s\n", inputFile)
		fmt.Printf("  输出 | Output: %s\n", outputFile)

		if err := processIndexFile(inputFile, outputFile, indexType); err != nil {
			fmt.Printf("  错误 | Error: %v\n", err)
			failCount++
			continue
		}

		fmt.Printf("  成功 | Success\n")
		successCount++
	}

	fmt.Println()
	fmt.Printf("计算完成: %d 成功, %d 失败\n", successCount, failCount)
	fmt.Printf("Calculation complete: %d succeeded, %d failed\n", successCount, failCount)

	if failCount > 0 {
		return apperrors.New(apperrors.E7001,
			fmt.Sprintf("%d 个文件计算失败 | %d file(s) failed calculation", failCount, failCount))
	}

	return nil
}

func generateIndexOutputPath(inputFile, inputPath, outputPath string, inputIsDir bool, indexType string) string {
	expandedOutput := expandPath(outputPath)
	base := filepath.Base(inputFile)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	suffix := fmt.Sprintf("_%s", strings.ToLower(indexType))

	if !inputIsDir {
		outputInfo, err := os.Stat(expandedOutput)
		if err == nil && outputInfo.IsDir() {
			return filepath.Join(expandedOutput, fmt.Sprintf("%s%s%s", name, suffix, ext))
		}
		if expandedOutput != "" && filepath.Ext(expandedOutput) != "" {
			return expandedOutput
		}
		return filepath.Join(filepath.Dir(expandedOutput), fmt.Sprintf("%s%s%s", name, suffix, ext))
	}

	relPath, err := filepath.Rel(expandPath(inputPath), inputFile)
	if err != nil {
		return filepath.Join(expandedOutput, fmt.Sprintf("%s%s%s", name, suffix, ext))
	}

	relDir := filepath.Dir(relPath)
	relBase := filepath.Base(relPath)
	relExt := filepath.Ext(relBase)
	relName := strings.TrimSuffix(relBase, relExt)
	return filepath.Join(expandedOutput, relDir, fmt.Sprintf("%s%s%s", relName, suffix, relExt))
}

func processIndexFile(inputPath, outputPath, indexType string) error {
	reader, err := appio.NewGeoTIFFReader(inputPath, indexChunkSizeMB)
	if err != nil {
		return err
	}
	defer reader.Close()

	meta := reader.Metadata()

	sensorType, err := getSensorType(meta)
	if err != nil {
		return err
	}

	formula, err := getFormula(sensorType, indexType)
	if err != nil {
		return err
	}

	outputMeta := *meta
	outputMeta.NumBands = 1
	noDataVal := indexNoData
	outputMeta.Bands = []types.BandInfo{
		{
			Index:       1,
			Name:        strings.ToUpper(indexType),
			Description: fmt.Sprintf("%s Vegetation Index", strings.ToUpper(indexType)),
			DataType:    "float32",
			NoDataValue: &noDataVal,
			MinValue:    -1,
			MaxValue:    1,
		},
	}

	writer, err := appio.NewGeoTIFFWriter(outputPath, &outputMeta, indexChunkSizeMB)
	if err != nil {
		return err
	}
	defer writer.Close()

	idxConfig := types.VegetationIndexConfig{
		IndexType:   indexType,
		Formula:     formula,
		NoDataValue: indexNoData,
	}

	iterator := reader.Iterator()
	for iterator.HasNext() {
		chunk, err := iterator.Next()
		if err != nil {
			return err
		}

		processedChunk, err := calculateVegetationIndex(chunk, idxConfig, meta)
		if err != nil {
			return err
		}

		if err := writer.WriteChunk(processedChunk); err != nil {
			return err
		}
	}

	return nil
}

func calculateVegetationIndex(chunk *types.Chunk, idxConfig types.VegetationIndexConfig, meta *types.GeoTIFFMetadata) (*types.Chunk, error) {
	data, ok := chunk.Data.([][]float64)
	if !ok {
		return nil, apperrors.New(apperrors.E1001, "invalid chunk data format")
	}

	bandMap := buildBandMap(meta)
	formula := idxConfig.Formula
	if formula == "" {
		f, _ := config.GetIndexFormula(meta.SensorType, idxConfig.IndexType)
		formula = f
	}

	parsed := parseFormula(formula, bandMap)
	rows := chunk.Height
	cols := chunk.Width
	numPixels := rows * cols
	resultData := make([][]float64, 1)
	resultData[0] = make([]float64, numPixels)

	for i := 0; i < numPixels; i++ {
		values := make(map[string]float64)
		for bandKey, bandIdx := range bandMap {
			if bandIdx < len(data) && i < len(data[bandIdx]) {
				values[bandKey] = data[bandIdx][i]
			}
		}
		resultData[0][i] = evaluateFormula(parsed, values, idxConfig.NoDataValue)
	}

	resultChunk := *chunk
	resultChunk.Data = resultData
	return &resultChunk, nil
}

func buildBandMap(meta *types.GeoTIFFMetadata) map[string]int {
	bandMap := make(map[string]int)
	for i, band := range meta.Bands {
		key := fmt.Sprintf("B%d", band.Index)
		bandMap[key] = i
		altKey := fmt.Sprintf("b%d", band.Index)
		bandMap[altKey] = i
	}
	return bandMap
}

type formulaToken struct {
	Type  string
	Value string
	Op    rune
	Num   float64
	Band  string
}

func parseFormula(formula string, bandMap map[string]int) []formulaToken {
	var tokens []formulaToken
	re := regexp.MustCompile(`([Bb]\d+[Aa]?|\d+\.?\d*|[+\-*/()])`)
	matches := re.FindAllString(formula, -1)
	for _, match := range matches {
		switch {
		case strings.ContainsAny(match, "+-*/()"):
			tokens = append(tokens, formulaToken{Type: "op", Op: rune(match[0])})
		case regexp.MustCompile(`^[Bb]\d`).MatchString(match):
			upper := strings.ToUpper(match)
			if _, ok := bandMap[upper]; ok {
				tokens = append(tokens, formulaToken{Type: "band", Band: upper})
			}
		default:
			if num, err := strconv.ParseFloat(match, 64); err == nil {
				tokens = append(tokens, formulaToken{Type: "num", Num: num})
			}
		}
	}
	return tokens
}

func evaluateFormula(tokens []formulaToken, values map[string]float64, noData float64) float64 {
	if len(tokens) == 0 {
		return noData
	}
	var output []formulaToken
	var opStack []rune
	precedence := map[rune]int{'(': 0, ')': 0, '+': 1, '-': 1, '*': 2, '/': 2}
	for _, tok := range tokens {
		switch tok.Type {
		case "num", "band":
			output = append(output, tok)
		case "op":
			if tok.Op == '(' {
				opStack = append(opStack, tok.Op)
			} else if tok.Op == ')' {
				for len(opStack) > 0 && opStack[len(opStack)-1] != '(' {
					output = append(output, formulaToken{Type: "op", Op: opStack[len(opStack)-1]})
					opStack = opStack[:len(opStack)-1]
				}
				if len(opStack) > 0 {
					opStack = opStack[:len(opStack)-1]
				}
			} else {
				for len(opStack) > 0 && precedence[opStack[len(opStack)-1]] >= precedence[tok.Op] && opStack[len(opStack)-1] != '(' {
					output = append(output, formulaToken{Type: "op", Op: opStack[len(opStack)-1]})
					opStack = opStack[:len(opStack)-1]
				}
				opStack = append(opStack, tok.Op)
			}
		}
	}
	for len(opStack) > 0 {
		output = append(output, formulaToken{Type: "op", Op: opStack[len(opStack)-1]})
		opStack = opStack[:len(opStack)-1]
	}
	var stack []float64
	for _, tok := range output {
		switch tok.Type {
		case "num":
			stack = append(stack, tok.Num)
		case "band":
			if v, ok := values[tok.Band]; ok {
				stack = append(stack, v)
			} else {
				stack = append(stack, noData)
			}
		case "op":
			if len(stack) < 2 {
				return noData
			}
			b := stack[len(stack)-1]
			a := stack[len(stack)-2]
			stack = stack[:len(stack)-2]
			switch tok.Op {
			case '+':
				stack = append(stack, a+b)
			case '-':
				stack = append(stack, a-b)
			case '*':
				stack = append(stack, a*b)
			case '/':
				if b == 0 || math.IsNaN(a) || math.IsNaN(b) {
					stack = append(stack, noData)
				} else {
					stack = append(stack, a/b)
				}
			}
		}
	}
	if len(stack) == 1 {
		return stack[0]
	}
	return noData
}
