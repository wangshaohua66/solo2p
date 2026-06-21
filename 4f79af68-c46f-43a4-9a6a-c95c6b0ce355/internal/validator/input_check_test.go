package validator

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestValidateStation(t *testing.T) {
	tests := []struct {
		name    string
		station string
		wantErr bool
	}{
		{"空字符串", "", false},
		{"标准格式", "K100+000", false},
		{"标准格式2", "K123+456", false},
		{"单位数公里", "K0+000", false},
		{"缺少K前缀", "100+000", true},
		{"缺少加号", "K100000", true},
		{"非数字", "Kabc+def", true},
		{"缺少米数", "K100+", true},
		{"缺少公里数", "+500", true},
		{"多余空格", "K100 +000", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateStation(tt.station)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateStation(%q) error = %v, wantErr %v", tt.station, err, tt.wantErr)
			}
		})
	}
}

func TestParseStationToMeters(t *testing.T) {
	tests := []struct {
		name    string
		station string
		want    int
		wantErr bool
	}{
		{"零桩号", "K0+000", 0, false},
		{"1公里", "K1+000", 1000, false},
		{"100公里500米", "K100+500", 100500, false},
		{"无效格式", "invalid", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseStationToMeters(tt.station)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseStationToMeters(%q) error = %v, wantErr %v", tt.station, err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("ParseStationToMeters(%q) = %d, want %d", tt.station, got, tt.want)
			}
		})
	}
}

func TestFormatMetersToStation(t *testing.T) {
	tests := []struct {
		name   string
		meters int
		want   string
	}{
		{"零", 0, "K0+000"},
		{"1公里", 1000, "K1+000"},
		{"100公里500米", 100500, "K100+500"},
		{"2公里300米", 2300, "K2+300"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FormatMetersToStation(tt.meters)
			if got != tt.want {
				t.Errorf("FormatMetersToStation(%d) = %q, want %q", tt.meters, got, tt.want)
			}
		})
	}
}

func TestValidateStationRange(t *testing.T) {
	tests := []struct {
		name         string
		startStation string
		endStation   string
		wantErr      bool
	}{
		{"空字符串", "", "", false},
		{"有效范围", "K100+000", "K200+000", false},
		{"相同桩号", "K100+000", "K100+000", false},
		{"起始大于终止", "K200+000", "K100+000", true},
		{"起始格式错误", "invalid", "K200+000", true},
		{"终止格式错误", "K100+000", "invalid", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateStationRange(tt.startStation, tt.endStation)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateStationRange(%q, %q) error = %v, wantErr %v",
					tt.startStation, tt.endStation, err, tt.wantErr)
			}
		})
	}
}

func TestValidateRouteID(t *testing.T) {
	tests := []struct {
		name    string
		routeID string
		wantErr bool
	}{
		{"空字符串", "", false},
		{"国道", "G108", false},
		{"省道", "S305", false},
		{"县道", "X201", false},
		{"乡道", "T102", false},
		{"小写国道", "g108", false},
		{"无效前缀", "A108", true},
		{"纯数字", "108", true},
		{"含特殊字符", "G-108", true},
		{"空国道", "G", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRouteID(tt.routeID)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateRouteID(%q) error = %v, wantErr %v", tt.routeID, err, tt.wantErr)
			}
		})
	}
}

func TestValidateGrade(t *testing.T) {
	tests := []struct {
		name    string
		grade   string
		wantErr bool
	}{
		{"空字符串", "", false},
		{"优良中差", "优", false},
		{"良好", "良", false},
		{"中等", "中", false},
		{"较差", "差", false},
		{"字母A", "A", false},
		{"字母B", "B", false},
		{"字母C", "C", false},
		{"字母D", "D", false},
		{"优秀", "优秀", false},
		{"无效值", "X", true},
		{"数字", "1", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateGrade(tt.grade)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateGrade(%q) error = %v, wantErr %v", tt.grade, err, tt.wantErr)
			}
		})
	}
}

func TestNormalizeGrade(t *testing.T) {
	tests := []struct {
		name  string
		grade string
		want  string
	}{
		{"优", "优", "优"},
		{"优秀归一", "优秀", "优"},
		{"A归一", "A", "优"},
		{"良", "良", "良"},
		{"良好归一", "良好", "良"},
		{"B归一", "B", "良"},
		{"中", "中", "中"},
		{"中等归一", "中等", "中"},
		{"C归一", "C", "中"},
		{"差", "差", "差"},
		{"较差归一", "较差", "差"},
		{"D归一", "D", "差"},
		{"未知值原样返回", "X", "X"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeGrade(tt.grade)
			if got != tt.want {
				t.Errorf("NormalizeGrade(%q) = %q, want %q", tt.grade, got, tt.want)
			}
		})
	}
}

func TestValidateDate(t *testing.T) {
	tests := []struct {
		name    string
		date    string
		wantErr bool
	}{
		{"空字符串", "", false},
		{"标准日期", "2024-01-15", false},
		{"斜杠格式", "2024/01/15", false},
		{"紧凑格式", "20240115", false},
		{"带时间", "2024-01-15 10:30:00", false},
		{"无效月份", "2024-13-15", true},
		{"无效日", "2024-01-32", true},
		{"格式错误", "invalid", true},
		{"空格", " ", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateDate(tt.date)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateDate(%q) error = %v, wantErr %v", tt.date, err, tt.wantErr)
			}
		})
	}
}

func TestParseDate(t *testing.T) {
	tests := []struct {
		name    string
		date    string
		want    time.Time
		wantErr bool
	}{
		{"标准日期", "2024-01-15", time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), false},
		{"斜杠格式", "2024/01/15", time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), false},
		{"紧凑格式", "20240115", time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), false},
		{"空字符串返回零值", "", time.Time{}, false},
		{"无效格式", "invalid", time.Time{}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseDate(tt.date)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseDate(%q) error = %v, wantErr %v", tt.date, err, tt.wantErr)
				return
			}
			if !tt.wantErr && !got.IsZero() && !got.Equal(tt.want) {
				t.Errorf("ParseDate(%q) = %v, want %v", tt.date, got, tt.want)
			}
		})
	}
}

func TestValidateDateRange(t *testing.T) {
	tests := []struct {
		name      string
		startDate string
		endDate   string
		wantErr   bool
	}{
		{"都为空", "", "", false},
		{"有效范围", "2024-01-01", "2024-12-31", false},
		{"同一天", "2024-06-15", "2024-06-15", false},
		{"起始晚于终止", "2024-12-31", "2024-01-01", true},
		{"起始格式错误", "invalid", "2024-12-31", true},
		{"终止格式错误", "2024-01-01", "invalid", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateDateRange(tt.startDate, tt.endDate)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateDateRange(%q, %q) error = %v, wantErr %v",
					tt.startDate, tt.endDate, err, tt.wantErr)
			}
		})
	}
}

func TestValidateBudget(t *testing.T) {
	tests := []struct {
		name    string
		amount  float64
		wantErr bool
	}{
		{"零预算", 0, false},
		{"正数预算", 5000000, false},
		{"大数预算", 99999999999, false},
		{"负数预算", -100, true},
		{"小数预算", 0.01, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateBudget(tt.amount)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateBudget(%f) error = %v, wantErr %v", tt.amount, err, tt.wantErr)
			}
		})
	}
}

func TestValidateBatchID(t *testing.T) {
	tests := []struct {
		name    string
		batchID string
		wantErr bool
	}{
		{"空字符串", "", false},
		{"有效批次号", "Q1-2024", false},
		{"长批次号", "BATCH_2024_Q1_DETECTION", false},
		{"过短两字符", "AB", true},
		{"单字符", "A", true},
		{"刚好三字符", "ABC", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateBatchID(tt.batchID)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateBatchID(%q) error = %v, wantErr %v", tt.batchID, err, tt.wantErr)
			}
		})
	}
}

func TestValidateImportPath(t *testing.T) {
	tmpDir := t.TempDir()
	nonExistPath := filepath.Join(tmpDir, "nonexistent")

	tmpFile := filepath.Join(tmpDir, "test.txt")
	os.WriteFile(tmpFile, []byte("test"), 0644)

	tests := []struct {
		name    string
		path    string
		wantErr bool
	}{
		{"空路径", "", true},
		{"不存在路径", nonExistPath, true},
		{"有效目录", tmpDir, false},
		{"文件而非目录", tmpFile, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateImportPath(tt.path)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateImportPath(%q) error = %v, wantErr %v", tt.path, err, tt.wantErr)
			}
		})
	}
}

func TestValidateDeleteParams(t *testing.T) {
	tests := []struct {
		name    string
		params  *DeleteParams
		wantErr bool
	}{
		{
			name:    "全部为空",
			params:  &DeleteParams{},
			wantErr: true,
		},
		{
			name: "仅批次号",
			params: &DeleteParams{
				BatchID: "Q1-2024",
			},
			wantErr: false,
		},
		{
			name: "仅日期范围",
			params: &DeleteParams{
				StartDate: "2024-01-01",
				EndDate:   "2024-12-31",
			},
			wantErr: false,
		},
		{
			name: "批次号和日期",
			params: &DeleteParams{
				BatchID:   "Q1-2024",
				StartDate: "2024-01-01",
				EndDate:   "2024-12-31",
			},
			wantErr: false,
		},
		{
			name: "过短批次号",
			params: &DeleteParams{
				BatchID: "AB",
			},
			wantErr: true,
		},
		{
			name: "日期顺序错误",
			params: &DeleteParams{
				StartDate: "2024-12-31",
				EndDate:   "2024-01-01",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateDeleteParams(tt.params)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateDeleteParams() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateQueryParams(t *testing.T) {
	tests := []struct {
		name    string
		params  *QueryParams
		wantErr bool
	}{
		{
			name:    "空参数",
			params:  &QueryParams{},
			wantErr: false,
		},
		{
			name: "有效路线",
			params: &QueryParams{
				RouteID: "G108",
			},
			wantErr: false,
		},
		{
			name: "有效桩号范围",
			params: &QueryParams{
				StartStation: "K100+000",
				EndStation:   "K200+000",
			},
			wantErr: false,
		},
		{
			name: "有效日期范围",
			params: &QueryParams{
				StartDate: "2024-01-01",
				EndDate:   "2024-12-31",
			},
			wantErr: false,
		},
		{
			name: "无效路线",
			params: &QueryParams{
				RouteID: "invalid",
			},
			wantErr: true,
		},
		{
			name: "桩号顺序错误",
			params: &QueryParams{
				StartStation: "K200+000",
				EndStation:   "K100+000",
			},
			wantErr: true,
		},
		{
			name: "无效病害等级",
			params: &QueryParams{
				Grade: "X",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateQueryParams(tt.params)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateQueryParams() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateNumericField(t *testing.T) {
	tests := []struct {
		name      string
		value     string
		fieldName string
		want      float64
		wantErr   bool
	}{
		{"空值", "", "field", 0, true},
		{"整数", "100", "field", 100, false},
		{"小数", "3.14", "field", 3.14, false},
		{"带空格", "  100  ", "field", 100, false},
		{"非数字", "abc", "field", 0, true},
		{"负数", "-50", "field", -50, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ValidateNumericField(tt.value, tt.fieldName)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateNumericField(%q, %q) error = %v, wantErr %v",
					tt.value, tt.fieldName, err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("ValidateNumericField(%q, %q) = %f, want %f",
					tt.value, tt.fieldName, got, tt.want)
			}
		})
	}
}

func TestStationRoundTrip(t *testing.T) {
	stations := []string{"K0+000", "K1+500", "K100+250", "K999+999"}
	for _, s := range stations {
		meters, err := ParseStationToMeters(s)
		if err != nil {
			t.Errorf("ParseStationToMeters(%q) failed: %v", s, err)
			continue
		}
		formatted := FormatMetersToStation(meters)
		if formatted != s {
			t.Errorf("Round trip failed: %q -> %d -> %q", s, meters, formatted)
		}
	}
}
