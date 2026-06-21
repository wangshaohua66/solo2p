package validator

import (
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	pverrors "pavement/internal/errors"
)

var stationRegex = regexp.MustCompile(`^K\d+\+\d+$`)
var routeIDRegex = regexp.MustCompile(`^[GSTXgstx]\d+$`)

const (
	DateLayout     = "2006-01-02"
	DateTimeLayout = "2006-01-02 15:04:05"
)

type QueryParams struct {
	RouteID    string
	StartStation string
	EndStation   string
	Grade      string
	StartDate  string
	EndDate    string
}

type DeleteParams struct {
	BatchID   string
	StartDate string
	EndDate   string
}

type BudgetParams struct {
	TotalBudget float64
}

type ImportParams struct {
	DirPath string
}

func ValidateImportPath(path string) error {
	if path == "" {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidPath,
			"导入路径不能为空",
			"请使用 --dir 或 -d 参数指定包含CSV文件的目录路径",
			nil,
		)
	}
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidPath,
			fmt.Sprintf("路径不存在: %s", path),
			"请检查路径是否正确，确保目录已创建",
			err,
		)
	}
	if err != nil {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidPath,
			fmt.Sprintf("无法访问路径: %s", path),
			"请检查路径权限设置",
			err,
		)
	}
	if !info.IsDir() {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidPath,
			fmt.Sprintf("路径不是目录: %s", path),
			"请指定目录路径而非单个文件路径",
			nil,
		)
	}
	return nil
}

func ValidateStation(station string) error {
	if station == "" {
		return nil
	}
	if !stationRegex.MatchString(station) {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidStation,
			fmt.Sprintf("桩号格式不合法: %s", station),
			"桩号格式应为 K数字+数字，例如 K123+456",
			nil,
		)
	}
	return nil
}

func ValidateStationRange(startStation, endStation string) error {
	if startStation == "" || endStation == "" {
		return nil
	}
	if err := ValidateStation(startStation); err != nil {
		return err
	}
	if err := ValidateStation(endStation); err != nil {
		return err
	}
	startKM, startM := parseStation(startStation)
	endKM, endM := parseStation(endStation)
	startTotal := startKM*1000 + startM
	endTotal := endKM*1000 + endM
	if startTotal > endTotal {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidStation,
			fmt.Sprintf("起始桩号大于终止桩号: %s > %s", startStation, endStation),
			"请确保起始桩号小于终止桩号",
			nil,
		)
	}
	return nil
}

func parseStation(station string) (int, int) {
	parts := strings.Split(station, "+")
	kmPart := strings.TrimPrefix(parts[0], "K")
	km, _ := strconv.Atoi(kmPart)
	m, _ := strconv.Atoi(parts[1])
	return km, m
}

func ParseStationToMeters(station string) (int, error) {
	if err := ValidateStation(station); err != nil {
		return 0, err
	}
	km, m := parseStation(station)
	return km*1000 + m, nil
}

func FormatMetersToStation(meters int) string {
	km := meters / 1000
	m := meters % 1000
	return fmt.Sprintf("K%d+%03d", km, m)
}

func ValidateRouteID(routeID string) error {
	if routeID == "" {
		return nil
	}
	if !routeIDRegex.MatchString(routeID) {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidPath,
			fmt.Sprintf("路线编号格式不合法: %s", routeID),
			"路线编号格式应为 G/S/T/X 开头加数字，例如 G108、S305",
			nil,
		)
	}
	return nil
}

func ValidateGrade(grade string) error {
	if grade == "" {
		return nil
	}
	validGrades := map[string]bool{
		"优": true, "良": true, "中": true, "差": true,
		"优秀": true, "良好": true, "中等": true, "较差": true,
		"A": true, "B": true, "C": true, "D": true,
	}
	if !validGrades[grade] {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidStation,
			fmt.Sprintf("病害等级不合法: %s", grade),
			"病害等级应为 优/A、良/B、中/C、差/D 中的一个",
			nil,
		)
	}
	return nil
}

func NormalizeGrade(grade string) string {
	switch grade {
	case "优", "优秀", "A":
		return "优"
	case "良", "良好", "B":
		return "良"
	case "中", "中等", "C":
		return "中"
	case "差", "较差", "D":
		return "差"
	default:
		return grade
	}
}

func ValidateDate(dateStr string) error {
	if dateStr == "" {
		return nil
	}
	layouts := []string{DateLayout, DateTimeLayout, "2006/01/02", "20060102"}
	var valid bool
	for _, layout := range layouts {
		if _, err := time.Parse(layout, dateStr); err == nil {
			valid = true
			break
		}
	}
	if !valid {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidDate,
			fmt.Sprintf("日期格式不合法: %s", dateStr),
			"日期格式应为 YYYY-MM-DD，例如 2024-01-15",
			nil,
		)
	}
	return nil
}

func ParseDate(dateStr string) (time.Time, error) {
	if dateStr == "" {
		return time.Time{}, nil
	}
	layouts := []string{DateLayout, DateTimeLayout, "2006/01/02", "20060102"}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, dateStr); err == nil {
			return t, nil
		}
	}
	return time.Time{}, pverrors.NewValidatorError(
		pverrors.ErrValidatorInvalidDate,
		fmt.Sprintf("日期格式不合法: %s", dateStr),
		"日期格式应为 YYYY-MM-DD，例如 2024-01-15",
		nil,
	)
}

func ValidateDateRange(startDate, endDate string) error {
	if startDate == "" || endDate == "" {
		return nil
	}
	if err := ValidateDate(startDate); err != nil {
		return err
	}
	if err := ValidateDate(endDate); err != nil {
		return err
	}
	start, err1 := ParseDate(startDate)
	end, err2 := ParseDate(endDate)
	if err1 != nil || err2 != nil {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidDate,
			"日期解析失败",
			"请检查日期格式是否正确",
			nil,
		)
	}
	if start.After(end) {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidDate,
			fmt.Sprintf("起始日期晚于终止日期: %s > %s", startDate, endDate),
			"请确保起始日期早于或等于终止日期",
			nil,
		)
	}
	return nil
}

func ValidateBudget(amount float64) error {
	if amount < 0 {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorNegativeBudget,
			fmt.Sprintf("预算金额不能为负数: %.2f", amount),
			"请输入非负的预算金额",
			nil,
		)
	}
	return nil
}

func ValidateBatchID(batchID string) error {
	if batchID == "" {
		return nil
	}
	if len(batchID) < 3 {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidBatch,
			fmt.Sprintf("批次号过短: %s", batchID),
			"批次号长度应至少为3个字符",
			nil,
		)
	}
	return nil
}

func ValidateDeleteParams(params *DeleteParams) error {
	if params.BatchID == "" && params.StartDate == "" && params.EndDate == "" {
		return pverrors.NewValidatorError(
			pverrors.ErrValidatorInvalidBatch,
			"缺少删除条件",
			"请指定 --batch 批次号或 --start-date/--end-date 日期范围",
			nil,
		)
	}
	if err := ValidateBatchID(params.BatchID); err != nil {
		return err
	}
	if err := ValidateDateRange(params.StartDate, params.EndDate); err != nil {
		return err
	}
	return nil
}

func ValidateQueryParams(params *QueryParams) error {
	if err := ValidateRouteID(params.RouteID); err != nil {
		return err
	}
	if err := ValidateStationRange(params.StartStation, params.EndStation); err != nil {
		return err
	}
	if err := ValidateGrade(params.Grade); err != nil {
		return err
	}
	if err := ValidateDateRange(params.StartDate, params.EndDate); err != nil {
		return err
	}
	return nil
}

func ValidateNumericField(value string, fieldName string) (float64, error) {
	if value == "" {
		return 0, fmt.Errorf("%s不能为空", fieldName)
	}
	v, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		return 0, fmt.Errorf("%s不是合法数字: %s", fieldName, value)
	}
	return v, nil
}
