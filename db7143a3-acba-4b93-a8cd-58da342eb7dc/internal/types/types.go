package types

import (
	"time"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
)

type TaskStatus string

const (
	TaskStatusPending TaskStatus = "pending"
	TaskStatusRunning TaskStatus = "running"
	TaskStatusDone    TaskStatus = "done"
	TaskStatusFailed  TaskStatus = "failed"
	TaskStatusDead    TaskStatus = "dead"
)

type TaskType string

const (
	TaskTypeConvertCRS TaskType = "convert_crs"
	TaskTypeIndexNDVI  TaskType = "index_ndvi"
	TaskTypeIndexEVI   TaskType = "index_evi"
	TaskTypeIndexSAVI  TaskType = "index_savi"
	TaskTypeIndexCustom TaskType = "index_custom"
)

type SensorType string

const (
	SensorSentinel2  SensorType = "sentinel2"
	SensorLandsat8   SensorType = "landsat8"
	SensorGF2        SensorType = "gf2"
	SensorUnknown    SensorType = "unknown"
)

type Bounds struct {
	MinX float64
	MaxX float64
	MinY float64
	MaxY float64
}

type GeoTransform struct {
	OriginX    float64
	PixelWidth float64
	RotationX  float64
	OriginY    float64
	RotationY  float64
	PixelHeight float64
}

type BandInfo struct {
	Index          int
	Name           string
	Description    string
	DataType       string
	NoDataValue    *float64
	MinValue       float64
	MaxValue       float64
	MeanValue      float64
	StdDev         float64
	Histogram      []uint64
	HistogramBins  []float64
}

type GeoTIFFMetadata struct {
	FilePath       string
	FileSize       int64
	SHA256         string
	Width          int
	Height         int
	NumBands       int
	DataType       string
	Compression    string
	CRS            string
	EPSGCode       int
	GeoTransform   GeoTransform
	Bounds         Bounds
	PixelSizeX     float64
	PixelSizeY     float64
	LinearUnits    string
	AngularUnits   string
	Bands          []BandInfo
	SensorType     SensorType
	AcquisitionDate *time.Time
	CloudCover     *float64
}

type SevenParams struct {
	DX       float64
	DY       float64
	DZ       float64
	RX       float64
	RY       float64
	RZ       float64
	DS       float64
}

type NTv2Grid struct {
	FilePath   string
	GridName   string
	SourceEPSG int
	TargetEPSG int
}

type CRSTransformConfig struct {
	SourceEPSG    int
	TargetEPSG    int
	SevenParams   *SevenParams
	NTv2Grid      *NTv2Grid
	Interpolation string
}

type VegetationIndexConfig struct {
	IndexType    string
	Formula      string
	BandMapping  map[string]int
	NoDataValue  float64
	OutputFormat string
}

type Chunk struct {
	TaskID      string
	ChunkIndex  int
	TotalChunks int
	OffsetX     int
	OffsetY     int
	Width       int
	Height      int
	Data        interface{}
	Processed   bool
	Error       *apperrors.AppError
	RetryCount  int
}

type TaskProgress struct {
	TaskID        string
	CurrentChunk  int
	TotalChunks   int
	BytesProcessed int64
	BytesTotal    int64
	StartTime     time.Time
	LastUpdate    time.Time
	CurrentRate   float64
	AverageRate   float64
}

type ErrorRecord struct {
	Timestamp time.Time
	ErrorCode apperrors.ErrorCode
	Message   string
	Context   map[string]interface{}
}

type Task struct {
	ID                string
	Type              TaskType
	Status            TaskStatus
	InputPath         string
	OutputPath        string
	Config            interface{}
	Priority          int
	MaxRetries        int
	RetryCount        int
	CreatedAt         time.Time
	StartedAt         *time.Time
	CompletedAt       *time.Time
	Progress          TaskProgress
	Errors            []ErrorRecord
	CheckpointData    []byte
	WorkerID          string
	ParentTaskID      string
	Metadata          map[string]string
}

type WorkerStatus struct {
	ID           string
	Status       string
	CurrentTask  *string
	Processed    int64
	StartTime    time.Time
	LastActivity time.Time
}

type PipelineStats struct {
	TotalTasks     int
	PendingTasks   int
	RunningTasks   int
	CompletedTasks int
	FailedTasks    int
	DeadTasks      int
	ThroughputMBs  float64
	TotalBytes     int64
	ProcessedBytes int64
	StartTime      time.Time
	Uptime         time.Duration
	Workers        []WorkerStatus
}

type AuditLogEntry struct {
	Timestamp     time.Time
	TaskID        string
	Operation     string
	InputFile     string
	InputSHA256   string
	OutputFile    string
	OutputSHA256  string
	Operator      string
	Hostname      string
	Parameters    map[string]interface{}
	DurationMs    int64
	Success       bool
	ErrorCode     *apperrors.ErrorCode
	ErrorMessage  string
}

type Config struct {
	Global GlobalConfig       `yaml:"global"`
	CRS    CRSConfig          `yaml:"crs"`
	Index  IndexConfig        `yaml:"index"`
	IO     IOConfig           `yaml:"io"`
	Pipeline PipelineConfig   `yaml:"pipeline"`
	Daemon DaemonConfig       `yaml:"daemon"`
	Logging LoggingConfig     `yaml:"logging"`
	Sensors map[string]SensorPreset `yaml:"sensors"`
}

type GlobalConfig struct {
	MaxConcurrent   int    `yaml:"max_concurrent"`
	DatabasePath    string `yaml:"database_path"`
	TempDirectory   string `yaml:"temp_directory"`
	OutputDirectory string `yaml:"output_directory"`
}

type CRSConfig struct {
	DefaultSourceEPSG int                      `yaml:"default_source_epsg"`
	DefaultTargetEPSG int                      `yaml:"default_target_epsg"`
	SevenParams       map[string]SevenParams   `yaml:"seven_params"`
	NTv2Grids         map[string]NTv2Grid      `yaml:"ntv2_grids"`
	DatabasePath      string                   `yaml:"database_path"`
}

type IndexConfig struct {
	DefaultNoDataValue float64                `yaml:"default_nodata_value"`
	OutputFormat       string                 `yaml:"output_format"`
	CustomFormulas     map[string]string      `yaml:"custom_formulas"`
}

type IOConfig struct {
	ChunkSizeMB        int    `yaml:"chunk_size_mb"`
	MemoryLimitGB      float64 `yaml:"memory_limit_gb"`
	Compression        string `yaml:"compression"`
	CompressionQuality int    `yaml:"compression_quality"`
	WriteConcurrency   int    `yaml:"write_concurrency"`
}

type PipelineConfig struct {
	DefaultMaxRetries  int      `yaml:"default_max_retries"`
	RetryBackoffMs     int      `yaml:"retry_backoff_ms"`
	RetryBackoffMultiplier float64 `yaml:"retry_backoff_multiplier"`
	CheckpointInterval int      `yaml:"checkpoint_interval"`
	DeadTaskThreshold  int      `yaml:"dead_task_threshold"`
	QueueCapacity      int      `yaml:"queue_capacity"`
}

type DaemonConfig struct {
	PIDFile            string   `yaml:"pid_file"`
	LogFile            string   `yaml:"log_file"`
	WatchDirectories   []string `yaml:"watch_directories"`
	FileExtensions     []string `yaml:"file_extensions"`
	PollIntervalMs     int      `yaml:"poll_interval_ms"`
	GracefulShutdownSec int     `yaml:"graceful_shutdown_sec"`
	SystemdNotify      bool     `yaml:"systemd_notify"`
}

type LoggingConfig struct {
	Level             string `yaml:"level"`
	Format            string `yaml:"format"`
	AuditLogPath      string `yaml:"audit_log_path"`
	AuditLogMaxSizeMB int    `yaml:"audit_log_max_size_mb"`
	AuditLogMaxBackups int   `yaml:"audit_log_max_backups"`
	Verbose           bool   `yaml:"verbose"`
	Quiet             bool   `yaml:"quiet"`
}

type SensorPreset struct {
	Name            string              `yaml:"name"`
	Bands           map[string]BandSpec `yaml:"bands"`
	DefaultBands    map[string]string   `yaml:"default_bands"`
	NDVIFormula     string              `yaml:"ndvi_formula"`
	EVIFormula      string              `yaml:"evi_formula"`
	SAVIFormula     string              `yaml:"savi_formula"`
	MetadataPattern string              `yaml:"metadata_pattern"`
}

type BandSpec struct {
	Index       int     `yaml:"index"`
	Name        string  `yaml:"name"`
	WavelengthMin float64 `yaml:"wavelength_min"`
	WavelengthMax float64 `yaml:"wavelength_max"`
	Resolution  float64 `yaml:"resolution"`
	Description string  `yaml:"description"`
}

type ValidationResult struct {
	Valid   bool
	Errors  []ValidationError
	Warning []ValidationError
}

type ValidationError struct {
	Field    string
	Message  string
	Line     int
	Severity string
}
