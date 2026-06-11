package config

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/types"
	"github.com/remote-sensing/sentinel-cli/internal/util"
)

var defaultConfig = &types.Config{
	Global: types.GlobalConfig{
		MaxConcurrent:   4,
		DatabasePath:    "~/.sentinel/tasks.db",
		TempDirectory:   "~/.sentinel/tmp",
		OutputDirectory: "./output",
	},
	CRS: types.CRSConfig{
		DefaultSourceEPSG: 4326,
		DefaultTargetEPSG: 4490,
		SevenParams: map[string]types.SevenParams{
			"wgs84_to_cgcs2000":  {DX: 0, DY: 0, DZ: 0, RX: 0, RY: 0, RZ: 0, DS: 0},
			"wgs84_to_beijing54": {DX: -13.5, DY: -129.5, DZ: -76.8, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
			"wgs84_to_xian80":    {DX: -10.5, DY: -118.5, DZ: -63.5, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
		},
		NTv2Grids: map[string]types.NTv2Grid{
			"china_geoid": {FilePath: "~/.sentinel/crs/china_geoid.gsb", GridName: "CHINA_GEOID", SourceEPSG: 4326, TargetEPSG: 4490},
		},
		DatabasePath: "~/.sentinel/crs/epsg.db",
	},
	Index: types.IndexConfig{
		DefaultNoDataValue: 0,
		OutputFormat:       "GTiff",
		CustomFormulas: map[string]string{
			"ndvi": "(B8 - B4) / (B8 + B4)",
			"evi":  "2.5 * (B8 - B4) / (B8 + 6 * B4 - 7.5 * B2 + 1)",
			"savi": "((B8 - B4) / (B8 + B4 + 0.5)) * 1.5",
		},
	},
	IO: types.IOConfig{
		ChunkSizeMB:        64,
		MemoryLimitGB:      1.5,
		Compression:        "LZW",
		CompressionQuality: 90,
		WriteConcurrency:   2,
	},
	Pipeline: types.PipelineConfig{
		DefaultMaxRetries:      3,
		RetryBackoffMs:         1000,
		RetryBackoffMultiplier: 2.0,
		CheckpointInterval:     10,
		DeadTaskThreshold:      5,
		QueueCapacity:          1000,
	},
	Daemon: types.DaemonConfig{
		PIDFile:             "~/.sentinel/daemon.pid",
		LogFile:             "~/.sentinel/daemon.log",
		WatchDirectories:    []string{"./watch"},
		FileExtensions:      []string{".tif", ".tiff", ".img"},
		PollIntervalMs:      5000,
		GracefulShutdownSec: 30,
		SystemdNotify:       false,
	},
	Logging: types.LoggingConfig{
		Level:              "info",
		Format:             "json",
		AuditLogPath:       "~/.sentinel/audit.log",
		AuditLogMaxSizeMB:  100,
		AuditLogMaxBackups: 10,
		Verbose:            false,
		Quiet:              false,
	},
	Sensors: map[string]types.SensorPreset{
		"sentinel2": {
			Name: "Sentinel-2 MSI",
			Bands: map[string]types.BandSpec{
				"B1":  {Index: 1, Name: "Coastal Aerosol", WavelengthMin: 0.433, WavelengthMax: 0.453, Resolution: 60, Description: "Coastal aerosol band"},
				"B2":  {Index: 2, Name: "Blue", WavelengthMin: 0.458, WavelengthMax: 0.523, Resolution: 10, Description: "Blue visible band"},
				"B3":  {Index: 3, Name: "Green", WavelengthMin: 0.543, WavelengthMax: 0.578, Resolution: 10, Description: "Green visible band"},
				"B4":  {Index: 4, Name: "Red", WavelengthMin: 0.650, WavelengthMax: 0.680, Resolution: 10, Description: "Red visible band"},
				"B5":  {Index: 5, Name: "Vegetation Red Edge 1", WavelengthMin: 0.699, WavelengthMax: 0.711, Resolution: 20, Description: "Red edge band 1"},
				"B6":  {Index: 6, Name: "Vegetation Red Edge 2", WavelengthMin: 0.733, WavelengthMax: 0.748, Resolution: 20, Description: "Red edge band 2"},
				"B7":  {Index: 7, Name: "Vegetation Red Edge 3", WavelengthMin: 0.773, WavelengthMax: 0.793, Resolution: 20, Description: "Red edge band 3"},
				"B8":  {Index: 8, Name: "NIR", WavelengthMin: 0.785, WavelengthMax: 0.900, Resolution: 10, Description: "Near infrared band"},
				"B8A": {Index: 9, Name: "Vegetation Red Edge 4", WavelengthMin: 0.855, WavelengthMax: 0.875, Resolution: 20, Description: "Red edge band 4/NIR narrow"},
				"B9":  {Index: 10, Name: "Water Vapour", WavelengthMin: 0.935, WavelengthMax: 0.955, Resolution: 60, Description: "Water vapour band"},
				"B10": {Index: 11, Name: "SWIR Cirrus", WavelengthMin: 1.365, WavelengthMax: 1.385, Resolution: 60, Description: "Cirrus band"},
				"B11": {Index: 12, Name: "SWIR 1", WavelengthMin: 1.565, WavelengthMax: 1.655, Resolution: 20, Description: "Shortwave infrared band 1"},
				"B12": {Index: 13, Name: "SWIR 2", WavelengthMin: 2.100, WavelengthMax: 2.300, Resolution: 20, Description: "Shortwave infrared band 2"},
			},
			DefaultBands: map[string]string{
				"red":   "B4",
				"green": "B3",
				"blue":  "B2",
				"nir":   "B8",
				"swir1": "B11",
				"swir2": "B12",
			},
			NDVIFormula:     "(B8 - B4) / (B8 + B4)",
			EVIFormula:      "2.5 * (B8 - B4) / (B8 + 6 * B4 - 7.5 * B2 + 1)",
			SAVIFormula:     "((B8 - B4) / (B8 + B4 + 0.5)) * 1.5",
			MetadataPattern: "MTD_MSIL2A.xml",
		},
		"landsat8": {
			Name: "Landsat-8 OLI/TIRS",
			Bands: map[string]types.BandSpec{
				"B1":  {Index: 1, Name: "Coastal Aerosol", WavelengthMin: 0.435, WavelengthMax: 0.451, Resolution: 30, Description: "Coastal aerosol band"},
				"B2":  {Index: 2, Name: "Blue", WavelengthMin: 0.452, WavelengthMax: 0.512, Resolution: 30, Description: "Blue visible band"},
				"B3":  {Index: 3, Name: "Green", WavelengthMin: 0.533, WavelengthMax: 0.590, Resolution: 30, Description: "Green visible band"},
				"B4":  {Index: 4, Name: "Red", WavelengthMin: 0.636, WavelengthMax: 0.673, Resolution: 30, Description: "Red visible band"},
				"B5":  {Index: 5, Name: "NIR", WavelengthMin: 0.851, WavelengthMax: 0.879, Resolution: 30, Description: "Near infrared band"},
				"B6":  {Index: 6, Name: "SWIR 1", WavelengthMin: 1.566, WavelengthMax: 1.651, Resolution: 30, Description: "Shortwave infrared band 1"},
				"B7":  {Index: 7, Name: "SWIR 2", WavelengthMin: 2.107, WavelengthMax: 2.294, Resolution: 30, Description: "Shortwave infrared band 2"},
				"B8":  {Index: 8, Name: "Panchromatic", WavelengthMin: 0.503, WavelengthMax: 0.676, Resolution: 15, Description: "Panchromatic band"},
				"B9":  {Index: 9, Name: "Cirrus", WavelengthMin: 1.363, WavelengthMax: 1.384, Resolution: 30, Description: "Cirrus cloud band"},
				"B10": {Index: 10, Name: "TIRS 1", WavelengthMin: 10.60, WavelengthMax: 11.19, Resolution: 100, Description: "Thermal infrared band 1"},
				"B11": {Index: 11, Name: "TIRS 2", WavelengthMin: 11.50, WavelengthMax: 12.51, Resolution: 100, Description: "Thermal infrared band 2"},
			},
			DefaultBands: map[string]string{
				"red":   "B4",
				"green": "B3",
				"blue":  "B2",
				"nir":   "B5",
				"swir1": "B6",
				"swir2": "B7",
			},
			NDVIFormula:     "(B5 - B4) / (B5 + B4)",
			EVIFormula:      "2.5 * (B5 - B4) / (B5 + 6 * B4 - 7.5 * B2 + 1)",
			SAVIFormula:     "((B5 - B4) / (B5 + B4 + 0.5)) * 1.5",
			MetadataPattern: "*_MTL.txt",
		},
		"gf2": {
			Name: "Gaofen-2 PMS",
			Bands: map[string]types.BandSpec{
				"B1": {Index: 1, Name: "Pan", WavelengthMin: 0.450, WavelengthMax: 0.900, Resolution: 1, Description: "Panchromatic band"},
				"B2": {Index: 2, Name: "Blue", WavelengthMin: 0.450, WavelengthMax: 0.520, Resolution: 4, Description: "Blue visible band"},
				"B3": {Index: 3, Name: "Green", WavelengthMin: 0.520, WavelengthMax: 0.600, Resolution: 4, Description: "Green visible band"},
				"B4": {Index: 4, Name: "Red", WavelengthMin: 0.630, WavelengthMax: 0.690, Resolution: 4, Description: "Red visible band"},
				"B5": {Index: 5, Name: "NIR", WavelengthMin: 0.770, WavelengthMax: 0.890, Resolution: 4, Description: "Near infrared band"},
			},
			DefaultBands: map[string]string{
				"red":   "B4",
				"green": "B3",
				"blue":  "B2",
				"nir":   "B5",
			},
			NDVIFormula:     "(B5 - B4) / (B5 + B4)",
			EVIFormula:      "2.5 * (B5 - B4) / (B5 + 6 * B4 - 7.5 * B2 + 1)",
			SAVIFormula:     "((B5 - B4) / (B5 + B4 + 0.5)) * 1.5",
			MetadataPattern: "*.xml",
		},
	},
}

var validEPSGCodes = map[int]string{
	4326:  "WGS84 - World Geodetic System 1984",
	4490:  "CGCS2000 - China Geodetic Coordinate System 2000",
	4214:  "Beijing54 - Beijing Geodetic Coordinate System 1954",
	4610:  "Xian80 - Xi'an Geodetic Coordinate System 1980",
	3857:  "Web Mercator / Pseudo-Mercator",
	32649: "WGS 84 / UTM zone 49N",
	32650: "WGS 84 / UTM zone 50N",
	32651: "WGS 84 / UTM zone 51N",
	23849: "CGCS2000 / 3-degree Gauss-Kruger zone 25",
	23850: "CGCS2000 / 3-degree Gauss-Kruger zone 26",
}

func DefaultConfig() *types.Config {
	return deepCopy(defaultConfig)
}

func deepCopy(src *types.Config) *types.Config {
	dst := *src
	if src.Sensors != nil {
		dst.Sensors = make(map[string]types.SensorPreset, len(src.Sensors))
		for k, v := range src.Sensors {
			vCopy := v
			if v.Bands != nil {
				vCopy.Bands = make(map[string]types.BandSpec, len(v.Bands))
				for bk, bv := range v.Bands {
					vCopy.Bands[bk] = bv
				}
			}
			if v.DefaultBands != nil {
				vCopy.DefaultBands = make(map[string]string, len(v.DefaultBands))
				for dk, dv := range v.DefaultBands {
					vCopy.DefaultBands[dk] = dv
				}
			}
			dst.Sensors[k] = vCopy
		}
	}
	return &dst
}

var LastConfigNode *yaml.Node

func LoadConfig(paths ...string) (*types.Config, error) {
	cfg := DefaultConfig()
	LastConfigNode = nil
	var mergedNode *yaml.Node
	for _, path := range paths {
		expandedPath := util.ExpandPath(path)
		if _, err := os.Stat(expandedPath); os.IsNotExist(err) {
			return nil, apperrors.Wrap(err, apperrors.E5001, fmt.Sprintf("configuration file not found: %s", path))
		}
		data, err := os.ReadFile(expandedPath)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.E5001, fmt.Sprintf("cannot read config file: %s", path))
		}
		var node yaml.Node
		if err := yaml.Unmarshal(data, &node); err != nil {
			return nil, apperrors.Wrap(err, apperrors.E5002, fmt.Sprintf("YAML parse error in %s", path))
		}
		if err := node.Decode(cfg); err != nil {
			return nil, apperrors.Wrap(err, apperrors.E5002, fmt.Sprintf("YAML decode error in %s", path))
		}
		mergedNode = &node
	}
	LastConfigNode = mergedNode
	applyEnvOverrides(cfg)
	expandConfigPaths(cfg)
	return cfg, nil
}

func applyEnvOverrides(cfg *types.Config) {
	if v := os.Getenv("SENTINEL_MAX_CONCURRENT"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			cfg.Global.MaxConcurrent = i
		}
	}
	if v := os.Getenv("SENTINEL_DATABASE_PATH"); v != "" {
		cfg.Global.DatabasePath = v
	}
	if v := os.Getenv("SENTINEL_TEMP_DIR"); v != "" {
		cfg.Global.TempDirectory = v
	}
	if v := os.Getenv("SENTINEL_OUTPUT_DIR"); v != "" {
		cfg.Global.OutputDirectory = v
	}
	if v := os.Getenv("SENTINEL_CRS_DB_PATH"); v != "" {
		cfg.CRS.DatabasePath = v
	}
	if v := os.Getenv("SENTINEL_DAEMON_PIDFILE"); v != "" {
		cfg.Daemon.PIDFile = v
	}
	if v := os.Getenv("SENTINEL_LOG_LEVEL"); v != "" {
		cfg.Logging.Level = v
	}
	if v := os.Getenv("SENTINEL_VERBOSE"); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			cfg.Logging.Verbose = b
		}
	}
	if v := os.Getenv("SENTINEL_QUIET"); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			cfg.Logging.Quiet = b
		}
	}
}

func expandConfigPaths(cfg *types.Config) {
	cfg.Global.DatabasePath = util.ExpandPath(cfg.Global.DatabasePath)
	cfg.Global.TempDirectory = util.ExpandPath(cfg.Global.TempDirectory)
	cfg.Global.OutputDirectory = util.ExpandPath(cfg.Global.OutputDirectory)
	cfg.CRS.DatabasePath = util.ExpandPath(cfg.CRS.DatabasePath)
	cfg.Daemon.PIDFile = util.ExpandPath(cfg.Daemon.PIDFile)
	cfg.Daemon.LogFile = util.ExpandPath(cfg.Daemon.LogFile)
	cfg.Logging.AuditLogPath = util.ExpandPath(cfg.Logging.AuditLogPath)
	for i, dir := range cfg.Daemon.WatchDirectories {
		cfg.Daemon.WatchDirectories[i] = util.ExpandPath(dir)
	}
	for k, grid := range cfg.CRS.NTv2Grids {
		grid.FilePath = util.ExpandPath(grid.FilePath)
		cfg.CRS.NTv2Grids[k] = grid
	}
}

func ValidateConfig(cfg *types.Config, node *yaml.Node) types.ValidationResult {
	var result types.ValidationResult
	result.Valid = true

	var fieldLocations map[string]FieldLocation
	if node != nil {
		fieldLocations = GetFieldsWithLocation(node, "")
	}

	addError := func(field, message, severity string) {
		e := types.ValidationError{
			Field:    field,
			Message:  message,
			Severity: severity,
		}
		if fieldLocations != nil {
			if loc, ok := fieldLocations[field]; ok {
				e.Line = loc.Line
				e.Column = loc.Column
			}
		}
		if severity == "error" {
			result.Errors = append(result.Errors, e)
			result.Valid = false
		} else {
			result.Warning = append(result.Warning, e)
		}
	}

	if cfg.Global.MaxConcurrent < 1 || cfg.Global.MaxConcurrent > 16 {
		addError("global.max_concurrent", "must be between 1 and 16", "error")
	}

	if cfg.Global.DatabasePath == "" {
		addError("global.database_path", "cannot be empty", "error")
	}

	if cfg.IO.ChunkSizeMB < 1 || cfg.IO.ChunkSizeMB > 512 {
		addError("io.chunk_size_mb", "must be between 1 and 512", "error")
	}

	if cfg.IO.MemoryLimitGB < 0.5 || cfg.IO.MemoryLimitGB > 16 {
		addError("io.memory_limit_gb", "must be between 0.5 and 16", "error")
	}

	if cfg.Pipeline.DefaultMaxRetries < 0 || cfg.Pipeline.DefaultMaxRetries > 10 {
		addError("pipeline.default_max_retries", "must be between 0 and 10", "error")
	}

	if cfg.Pipeline.DeadTaskThreshold < cfg.Pipeline.DefaultMaxRetries {
		addError("pipeline.dead_task_threshold", "should be greater than default_max_retries", "warning")
	}

	validLogLevels := map[string]bool{"debug": true, "info": true, "warn": true, "error": true}
	if !validLogLevels[strings.ToLower(cfg.Logging.Level)] {
		addError("logging.level", "must be one of: debug, info, warn, error", "error")
	}

	validFormats := map[string]bool{"json": true, "text": true}
	if !validFormats[strings.ToLower(cfg.Logging.Format)] {
		addError("logging.format", "must be one of: json, text", "error")
	}

	validCompressions := map[string]bool{"none": true, "lzw": true, "deflate": true, "packbits": true}
	if !validCompressions[strings.ToLower(cfg.IO.Compression)] {
		addError("io.compression", "must be one of: none, lzw, deflate, packbits", "error")
	}

	for name, sensor := range cfg.Sensors {
		if sensor.Name == "" {
			addError(fmt.Sprintf("sensors.%s.name", name), "sensor name cannot be empty", "error")
		}
		if len(sensor.Bands) == 0 {
			addError(fmt.Sprintf("sensors.%s.bands", name), "no bands defined for sensor", "warning")
		}
	}

	if fieldLocations != nil {
		validFields := getValidFields()
		for field, loc := range fieldLocations {
			if !validFields[field] {
				result.Warning = append(result.Warning, types.ValidationError{
					Field:    field,
					Message:  fmt.Sprintf("unknown configuration key '%s' will be ignored", field),
					Line:     loc.Line,
					Column:   loc.Column,
					Severity: "warning",
				})
			}
		}
	}

	return result
}

func SaveConfig(cfg *types.Config, path string) error {
	expandedPath := util.ExpandPath(path)
	dir := filepath.Dir(expandedPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, fmt.Sprintf("cannot create directory: %s", dir))
	}
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E5002, "cannot marshal config to YAML")
	}
	if err := os.WriteFile(expandedPath, data, 0644); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, fmt.Sprintf("cannot write config file: %s", path))
	}
	return nil
}

func IsValidEPSG(code int) bool {
	_, ok := validEPSGCodes[code]
	return ok
}

func GetEPSGDescription(code int) string {
	if desc, ok := validEPSGCodes[code]; ok {
		return desc
	}
	return "Unknown"
}

func ListEPSGCodes() map[int]string {
	result := make(map[int]string, len(validEPSGCodes))
	for k, v := range validEPSGCodes {
		result[k] = v
	}
	return result
}

func ValidateBandCombination(sensor types.SensorType, formula string) types.ValidationResult {
	var result types.ValidationResult
	result.Valid = true

	sensorPreset, ok := defaultConfig.Sensors[string(sensor)]
	if !ok {
		result.Valid = false
		result.Errors = append(result.Errors, types.ValidationError{
			Field:    "sensor",
			Message:  fmt.Sprintf("unknown sensor type: %s", sensor),
			Severity: "error",
		})
		return result
	}

	tokens := tokenizeFormula(formula)
	for _, token := range tokens {
		if strings.HasPrefix(token, "B") && len(token) > 1 {
			if _, ok := sensorPreset.Bands[token]; !ok {
				result.Valid = false
				result.Errors = append(result.Errors, types.ValidationError{
					Field:    "formula",
					Message:  fmt.Sprintf("band %s not available for sensor %s", token, sensor),
					Severity: "error",
				})
			}
		}
	}

	if !validateFormulaSyntax(formula) {
		result.Valid = false
		result.Errors = append(result.Errors, types.ValidationError{
			Field:    "formula",
			Message:  "formula syntax is invalid",
			Severity: "error",
		})
	}

	return result
}

func tokenizeFormula(formula string) []string {
	var tokens []string
	var current strings.Builder
	for _, r := range formula {
		if strings.ContainsRune("+-*/() ", r) {
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
			if r != ' ' {
				tokens = append(tokens, string(r))
			}
		} else {
			current.WriteRune(r)
		}
	}
	if current.Len() > 0 {
		tokens = append(tokens, current.String())
	}
	return tokens
}

func validateFormulaSyntax(formula string) bool {
	parenCount := 0
	for _, r := range formula {
		if r == '(' {
			parenCount++
		} else if r == ')' {
			parenCount--
			if parenCount < 0 {
				return false
			}
		}
	}
	return parenCount == 0
}

func GetSensorPreset(sensor types.SensorType) (types.SensorPreset, bool) {
	preset, ok := defaultConfig.Sensors[string(sensor)]
	return preset, ok
}

func DetectSensorType(metadata map[string]string) types.SensorType {
	for k, v := range metadata {
		lk := strings.ToLower(k)
		lv := strings.ToLower(v)
		if strings.Contains(lk, "platform") || strings.Contains(lk, "sensor") {
			if strings.Contains(lv, "sentinel-2") || strings.Contains(lv, "sentinel2") {
				return types.SensorSentinel2
			}
			if strings.Contains(lv, "landsat8") || strings.Contains(lv, "landsat_8") {
				return types.SensorLandsat8
			}
			if strings.Contains(lv, "gf2") || strings.Contains(lv, "gaofen") {
				return types.SensorGF2
			}
		}
	}
	return types.SensorUnknown
}

func GetIndexFormula(sensor types.SensorType, indexType string) (string, bool) {
	preset, ok := defaultConfig.Sensors[string(sensor)]
	if !ok {
		return "", false
	}
	switch strings.ToLower(indexType) {
	case "ndvi":
		return preset.NDVIFormula, true
	case "evi":
		return preset.EVIFormula, true
	case "savi":
		return preset.SAVIFormula, true
	}
	return "", false
}

type FieldLocation struct {
	Line   int
	Column int
}

func GetFieldsWithLineNumbers(node *yaml.Node, prefix string) map[string]int {
	result := make(map[string]int)
	if node.Kind == yaml.DocumentNode && len(node.Content) > 0 {
		getFieldsRecursive(node.Content[0], prefix, result)
	}
	return result
}

func GetFieldsWithLocation(node *yaml.Node, prefix string) map[string]FieldLocation {
	result := make(map[string]FieldLocation)
	if node.Kind == yaml.DocumentNode && len(node.Content) > 0 {
		getFieldsRecursiveWithLocation(node.Content[0], prefix, result)
	}
	return result
}

func getFieldsRecursive(node *yaml.Node, prefix string, result map[string]int) {
	if node.Kind != yaml.MappingNode {
		return
	}
	for i := 0; i < len(node.Content); i += 2 {
		if i+1 >= len(node.Content) {
			break
		}
		keyNode := node.Content[i]
		valueNode := node.Content[i+1]
		key := keyNode.Value
		fullKey := key
		if prefix != "" {
			fullKey = prefix + "." + key
		}
		result[fullKey] = keyNode.Line
		if valueNode.Kind == yaml.MappingNode {
			getFieldsRecursive(valueNode, fullKey, result)
		}
	}
}

func getFieldsRecursiveWithLocation(node *yaml.Node, prefix string, result map[string]FieldLocation) {
	if node.Kind != yaml.MappingNode {
		return
	}
	for i := 0; i < len(node.Content); i += 2 {
		if i+1 >= len(node.Content) {
			break
		}
		keyNode := node.Content[i]
		valueNode := node.Content[i+1]
		key := keyNode.Value
		fullKey := key
		if prefix != "" {
			fullKey = prefix + "." + key
		}
		result[fullKey] = FieldLocation{
			Line:   keyNode.Line,
			Column: keyNode.Column,
		}
		if valueNode.Kind == yaml.MappingNode {
			getFieldsRecursiveWithLocation(valueNode, fullKey, result)
		}
	}
}

func ValidateConfigWithSchema(cfg *types.Config, data []byte) types.ValidationResult {
	var node yaml.Node
	if err := yaml.Unmarshal(data, &node); err != nil {
		return ValidateConfig(cfg, nil)
	}
	return ValidateConfig(cfg, &node)
}

func getValidFields() map[string]bool {
	valid := make(map[string]bool)
	t := reflect.TypeOf(types.Config{})
	addValidFields(reflect.ValueOf(types.Config{}), t, "", valid)
	return valid
}

func addValidFields(v reflect.Value, t reflect.Type, prefix string, valid map[string]bool) {
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		yamlTag := field.Tag.Get("yaml")
		if yamlTag == "" || yamlTag == "-" {
			continue
		}
		tagParts := strings.Split(yamlTag, ",")
		fieldName := tagParts[0]
		fullName := fieldName
		if prefix != "" {
			fullName = prefix + "." + fieldName
		}
		valid[fullName] = true
		fieldType := field.Type
		if fieldType.Kind() == reflect.Struct {
			addValidFields(v.Field(i), fieldType, fullName, valid)
		}
		if fieldType.Kind() == reflect.Ptr && fieldType.Elem().Kind() == reflect.Struct {
			if !v.Field(i).IsNil() {
				addValidFields(v.Field(i).Elem(), fieldType.Elem(), fullName, valid)
			}
		}
	}
}
