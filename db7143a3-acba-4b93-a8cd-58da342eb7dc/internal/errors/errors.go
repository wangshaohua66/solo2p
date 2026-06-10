package errors

import (
	"fmt"
	"strings"
)

type Severity string

const (
	SeverityInfo     Severity = "INFO"
	SeverityWarn     Severity = "WARN"
	SeverityError    Severity = "ERROR"
	SeverityCritical Severity = "CRITICAL"
)

type ErrorCode string

const (
	E1001 ErrorCode = "E1001"
	E1002 ErrorCode = "E1002"
	E1003 ErrorCode = "E1003"
	E1004 ErrorCode = "E1004"
	E1005 ErrorCode = "E1005"

	E2001 ErrorCode = "E2001"
	E2002 ErrorCode = "E2002"
	E2003 ErrorCode = "E2003"
	E2004 ErrorCode = "E2004"
	E2005 ErrorCode = "E2005"

	E3001 ErrorCode = "E3001"
	E3002 ErrorCode = "E3002"
	E3003 ErrorCode = "E3003"
	E3004 ErrorCode = "E3004"

	E4001 ErrorCode = "E4001"
	E4002 ErrorCode = "E4002"
	E4003 ErrorCode = "E4003"
	E4004 ErrorCode = "E4004"

	E5001 ErrorCode = "E5001"
	E5002 ErrorCode = "E5002"
	E5003 ErrorCode = "E5003"
	E5004 ErrorCode = "E5004"

	E6001 ErrorCode = "E6001"
	E6002 ErrorCode = "E6002"
	E6003 ErrorCode = "E6003"
	E6004 ErrorCode = "E6004"

	E7001 ErrorCode = "E7001"
	E7002 ErrorCode = "E7002"
	E7003 ErrorCode = "E7003"
)

var errorRegistry = map[ErrorCode]ErrorInfo{
	E1001: {
		Code:        E1001,
		Severity:    SeverityError,
		Message:     "GeoTIFF file is corrupted",
		Description: "The input GeoTIFF file cannot be parsed due to structural corruption or invalid headers.",
		Suggestions: []string{
			"Verify file integrity using gdalinfo",
			"Re-download the source image",
			"Check for partial file transfers",
		},
	},
	E1002: {
		Code:        E1002,
		Severity:    SeverityError,
		Message:     "Unsupported GeoTIFF compression",
		Description: "The GeoTIFF uses a compression method not supported by this tool.",
		Suggestions: []string{
			"Convert to uncompressed or LZW compression using gdal_translate",
			"Use gdal_translate -co COMPRESS=LZW input.tif output.tif",
		},
	},
	E1003: {
		Code:        E1003,
		Severity:    SeverityError,
		Message:     "Insufficient memory for GeoTIFF chunk",
		Description: "Memory allocation failed while processing a GeoTIFF chunk.",
		Suggestions: []string{
			"Reduce chunk size in configuration",
			"Increase system memory or close other applications",
			"Reduce number of concurrent workers",
		},
	},
	E1004: {
		Code:        E1004,
		Severity:    SeverityWarn,
		Message:     "NoData value missing in metadata",
		Description: "The GeoTIFF does not have a NoData value specified in its metadata.",
		Suggestions: []string{
			"Specify --nodata parameter explicitly",
			"Use gdal_edit.py -a_nodata 0 input.tif to set NoData",
		},
	},
	E1005: {
		Code:        E1005,
		Severity:    SeverityError,
		Message:     "GeoTIFF write permission denied",
		Description: "Cannot write output GeoTIFF to the specified directory.",
		Suggestions: []string{
			"Check output directory permissions",
			"Ensure directory exists",
			"Verify disk space is available",
		},
	},

	E2001: {
		Code:        E2001,
		Severity:    SeverityError,
		Message:     "Invalid EPSG code",
		Description: "The provided EPSG code is not recognized or not in the database.",
		Suggestions: []string{
			"Check EPSG code at https://epsg.io",
			"Use 'sentinel inspect epsg' to list supported codes",
			"Common codes: 4326 (WGS84), 4490 (CGCS2000), 4214 (Beijing54)",
		},
	},
	E2002: {
		Code:        E2002,
		Severity:    SeverityCritical,
		Message:     "CRS database missing",
		Description: "The EPSG database file or NTv2 grid files are missing.",
		Suggestions: []string{
			"Run 'sentinel config init' to generate default config",
			"Set CRS_DATABASE_PATH environment variable",
			"Reinstall the tool to restore bundled CRS data",
		},
	},
	E2003: {
		Code:        E2003,
		Severity:    SeverityError,
		Message:     "Seven parameters invalid",
		Description: "The Bursa-Wolf seven parameters for datum transformation are invalid or out of range.",
		Suggestions: []string{
			"Verify parameters with local survey authority",
			"Check units (meters for translations, ppm for scale)",
			"Use default parameters for common transformations",
		},
	},
	E2004: {
		Code:        E2004,
		Severity:    SeverityError,
		Message:     "NTv2 grid file not found",
		Description: "The specified NTv2 grid file (.gsb) cannot be located.",
		Suggestions: []string{
			"Download grid file from national mapping agency",
			"Set NTv2 path in configuration file",
			"Use seven-parameter transformation as fallback",
		},
	},
	E2005: {
		Code:        E2005,
		Severity:    SeverityError,
		Message:     "Coordinate out of transformation bounds",
		Description: "Input coordinates are outside the valid range for the transformation.",
		Suggestions: []string{
			"Verify input coordinates are correct",
			"Check that coordinates are in expected units (degrees/meters)",
			"Use a transformation appropriate for the geographic area",
		},
	},

	E3001: {
		Code:        E3001,
		Severity:    SeverityError,
		Message:     "BoltDB initialization failed",
		Description: "Cannot open or create the BoltDB database file.",
		Suggestions: []string{
			"Check database directory permissions",
			"Verify disk space is available",
			"Ensure no other process has locked the database",
		},
	},
	E3002: {
		Code:        E3002,
		Severity:    SeverityError,
		Message:     "Task serialization failed",
		Description: "Cannot serialize task data for storage in BoltDB.",
		Suggestions: []string{
			"Check for invalid characters in task parameters",
			"Reduce task payload size",
			"Review task metadata for circular references",
		},
	},
	E3003: {
		Code:        E3003,
		Severity:    SeverityError,
		Message:     "BoltDB transaction conflict",
		Description: "A write transaction conflict occurred in BoltDB.",
		Suggestions: []string{
			"Retry the operation",
			"Reduce batch size for bulk operations",
			"Ensure single writer pattern is respected",
		},
	},
	E3004: {
		Code:        E3004,
		Severity:    SeverityWarn,
		Message:     "Task not found in database",
		Description: "The requested task ID does not exist in the database.",
		Suggestions: []string{
			"Verify the task ID is correct",
			"List all tasks with 'sentinel batch status'",
			"Check if task was purged by retention policy",
		},
	},

	E4001: {
		Code:        E4001,
		Severity:    SeverityError,
		Message:     "Input path not readable",
		Description: "The input file or directory cannot be read.",
		Suggestions: []string{
			"Check file/directory permissions",
			"Verify path exists",
			"Ensure file is not locked by another process",
		},
	},
	E4002: {
		Code:        E4002,
		Severity:    SeverityError,
		Message:     "Invalid band combination for sensor",
		Description: "The specified band combination is not valid for the detected sensor type.",
		Suggestions: []string{
			"Use 'sentinel inspect bands' to list available bands",
			"Check sensor metadata for correct band numbers",
			"Use preset formulas: --index ndvi instead of custom formula",
		},
	},
	E4003: {
		Code:        E4003,
		Severity:    SeverityError,
		Message:     "Band formula syntax error",
		Description: "The custom band combination formula has a syntax error.",
		Suggestions: []string{
			"Use standard operators: +, -, *, /, ()",
			"Reference bands as B1, B2, etc.",
			"Example: (B8 - B4) / (B8 + B4)",
		},
	},
	E4004: {
		Code:        E4004,
		Severity:    SeverityWarn,
		Message:     "Sensor type auto-detection failed",
		Description: "Cannot automatically determine sensor type from metadata.",
		Suggestions: []string{
			"Specify --sensor parameter explicitly",
			"Check that metadata files are present",
			"Supported sensors: sentinel2, landsat8, gf2",
		},
	},

	E5001: {
		Code:        E5001,
		Severity:    SeverityError,
		Message:     "Configuration file not found",
		Description: "The specified configuration file does not exist.",
		Suggestions: []string{
			"Run 'sentinel config init' to create default config",
			"Verify the config file path",
			"Use --config flag to specify location",
		},
	},
	E5002: {
		Code:        E5002,
		Severity:    SeverityError,
		Message:     "YAML parse error",
		Description: "The configuration file has YAML syntax errors.",
		Suggestions: []string{
			"Check indentation (YAML requires 2 spaces)",
			"Validate with online YAML linter",
			"Run 'sentinel config validate' for detailed errors",
		},
	},
	E5003: {
		Code:        E5003,
		Severity:    SeverityError,
		Message:     "Schema validation failed",
		Description: "Configuration does not match the required schema.",
		Suggestions: []string{
			"Review schema error messages for specific fields",
			"Run 'sentinel config validate' with --verbose",
			"Compare with 'sentinel config init' output",
		},
	},
	E5004: {
		Code:        E5004,
		Severity:    SeverityWarn,
		Message:     "Unknown configuration key",
		Description: "Configuration contains unrecognized keys that will be ignored.",
		Suggestions: []string{
			"Remove unknown keys from configuration",
			"Check for typos in key names",
			"Refer to documentation for valid configuration keys",
		},
	},

	E6001: {
		Code:        E6001,
		Severity:    SeverityError,
		Message:     "Daemon already running",
		Description: "Another instance of the sentinel daemon is already running.",
		Suggestions: []string{
			"Run 'sentinel daemon stop' first",
			"Check PID file for existing process",
			"Kill stale daemon process manually",
		},
	},
	E6002: {
		Code:        E6002,
		Severity:    SeverityError,
		Message:     "Daemon PID file locked",
		Description: "Cannot write daemon PID file due to file lock.",
		Suggestions: []string{
			"Check permissions on PID file directory",
			"Remove stale PID file if daemon is not running",
			"Use --pidfile flag to specify alternate location",
		},
	},
	E6003: {
		Code:        E6003,
		Severity:    SeverityCritical,
		Message:     "Daemon watcher failed",
		Description: "The file system watcher encountered a fatal error.",
		Suggestions: []string{
			"Check watch directory permissions",
			"Verify inotify/macFSEvents is available",
			"Reduce number of watched directories",
		},
	},
	E6004: {
		Code:        E6004,
		Severity:    SeverityWarn,
		Message:     "Graceful shutdown incomplete",
		Description: "Some tasks did not complete during graceful shutdown period.",
		Suggestions: []string{
			"Increase shutdown timeout in configuration",
			"Retry failed tasks with 'sentinel batch retry'",
			"Check task logs for details of incomplete work",
		},
	},

	E7001: {
		Code:        E7001,
		Severity:    SeverityError,
		Message:     "Pipeline worker panicked",
		Description: "A worker goroutine panicked during task execution.",
		Suggestions: []string{
			"Check audit log for stack trace",
			"Retry the task with 'sentinel batch retry'",
			"Report this as a bug if it occurs repeatedly",
		},
	},
	E7002: {
		Code:        E7002,
		Severity:    SeverityError,
		Message:     "Checkpoint corruption detected",
		Description: "The pipeline checkpoint data is corrupted and cannot be recovered.",
		Suggestions: []string{
			"Use --ignore-checkpoint flag to restart from beginning",
			"Restore database from backup if available",
			"Re-queue affected tasks",
		},
	},
	E7003: {
		Code:        E7003,
		Severity:    SeverityError,
		Message:     "Maximum retry attempts exceeded",
		Description: "Task has failed maximum number of retry attempts and is marked dead.",
		Suggestions: []string{
			"Review task error history with 'sentinel batch status --task-id <id>'",
			"Fix root cause of failure (data, permissions, etc.)",
			"Reset task with 'sentinel batch retry --force'",
		},
	},
}

type ErrorInfo struct {
	Code        ErrorCode
	Severity    Severity
	Message     string
	Description string
	Suggestions []string
}

type AppError struct {
	Code      ErrorCode
	Severity  Severity
	Message   string
	Cause     error
	Context   map[string]interface{}
	LineNo    int
	Filename  string
}

func (e *AppError) Error() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("[%s] %s: %s", e.Code, e.Severity, e.Message))
	if e.Cause != nil {
		sb.WriteString(fmt.Sprintf(" (caused by: %v)", e.Cause))
	}
	if e.Filename != "" {
		sb.WriteString(fmt.Sprintf(" at %s:%d", e.Filename, e.LineNo))
	}
	return sb.String()
}

func (e *AppError) WithCause(err error) *AppError {
	e.Cause = err
	return e
}

func (e *AppError) WithContext(key string, value interface{}) *AppError {
	if e.Context == nil {
		e.Context = make(map[string]interface{})
	}
	e.Context[key] = value
	return e
}

func (e *AppError) WithLocation(filename string, lineNo int) *AppError {
	e.Filename = filename
	e.LineNo = lineNo
	return e
}

func New(code ErrorCode, message string) *AppError {
	info, ok := errorRegistry[code]
	if !ok {
		info = ErrorInfo{
			Code:     code,
			Severity: SeverityError,
			Message:  "Unknown error",
		}
	}
	if message == "" {
		message = info.Message
	}
	return &AppError{
		Code:     code,
		Severity: info.Severity,
		Message:  message,
	}
}

func Wrap(err error, code ErrorCode, message string) *AppError {
	appErr := New(code, message)
	appErr.Cause = err
	return appErr
}

func GetErrorInfo(code ErrorCode) (ErrorInfo, bool) {
	info, ok := errorRegistry[code]
	return info, ok
}

func ListErrorCodes() []ErrorCode {
	codes := make([]ErrorCode, 0, len(errorRegistry))
	for code := range errorRegistry {
		codes = append(codes, code)
	}
	return codes
}

func (e *AppError) Suggestions() []string {
	info, ok := errorRegistry[e.Code]
	if !ok {
		return nil
	}
	return info.Suggestions
}

func (e *AppError) FullDescription() string {
	info, ok := errorRegistry[e.Code]
	if !ok {
		return e.Message
	}
	return info.Description
}
