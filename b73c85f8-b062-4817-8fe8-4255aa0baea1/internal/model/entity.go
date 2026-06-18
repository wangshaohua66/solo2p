package model

import (
	"time"
)

type PipelineLevel string

const (
	PipelineLevel1 PipelineLevel = "LEVEL1"
	PipelineLevel2 PipelineLevel = "LEVEL2"
	PipelineLevel3 PipelineLevel = "LEVEL3"
)

type Pipeline struct {
	ID            uint          `gorm:"primaryKey" json:"id"`
	Name           string        `gorm:"size:100;not null" json:"name"`
	Code           string        `gorm:"size:50;uniqueIndex;not null" json:"code"`
	Level          PipelineLevel `gorm:"size:20;not null" json:"level"`
	Length         float64     `json:"length"`
	StartPoint     string      `gorm:"size:100" json:"start_point"`
	EndPoint       string      `gorm:"size:100" json:"end_point"`
	RouteCoords    string      `gorm:"type:text" json:"route_coords"`
	GateStationID  *uint       `json:"gate_station_id"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type GateStation struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	Code      string    `gorm:"size:50;uniqueIndex;not null" json:"code"`
	Address   string    `gorm:"size:200" json:"address"`
	Location  string    `gorm:"size:100" json:"location"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PressureRegulatingStation struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Name         string `gorm:"size:100;not null" json:"name"`
	Code         string `gorm:"size:50;uniqueIndex;not null" json:"code"`
	Address      string `gorm:"size:200" json:"address"`
	Location     string `gorm:"size:100" json:"location"`
	MinPressure  float64 `json:"min_pressure"`
	MaxPressure  float64 `json:"max_pressure"`
	NormalPressure float64 `json:"normal_pressure"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type ValveWell struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Name         string `gorm:"size:100;not null" json:"name"`
	Code         string `gorm:"size:50;uniqueIndex;not null" json:"code"`
	Location     string `gorm:"size:100" json:"location"`
	PipelineID   uint `json:"pipeline_id"`
	ValveCount int `json:"valve_count"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type InspectorStatus string

const (
	InspectorStatusOnDuty InspectorStatus = "ON_DUTY"
	InspectorStatusLeave  InspectorStatus = "ON_LEAVE"
	InspectorStatusOff   InspectorStatus = "OFF_DUTY"
)

type Inspector struct {
	ID         uint            `gorm:"primaryKey" json:"id"`
	Name       string          `gorm:"size:50;not null" json:"name"`
	EmployeeNo string          `gorm:"size:50;uniqueIndex;not null" json:"employee_no"`
	Phone      string          `gorm:"size:20" json:"phone"`
	Status     InspectorStatus `gorm:"size:20;default:'ON_DUTY'" json:"status"`
	Area       string          `gorm:"size:100" json:"area"`
	Location   string          `gorm:"size:100" json:"location"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

type InspectionTaskStatus string

const (
	TaskStatusPending   InspectionTaskStatus = "PENDING"
	TaskStatusAccepted  InspectionTaskStatus = "ACCEPTED"
	TaskStatusInProgress InspectionTaskStatus = "IN_PROGRESS"
	TaskStatusCompleted InspectionTaskStatus = "COMPLETED"
	TaskStatusExpired   InspectionTaskStatus = "EXPIRED"
)

type InspectionTask struct {
	ID          uint                 `gorm:"primaryKey" json:"id"`
	TaskNo      string               `gorm:"size:50;uniqueIndex;not null" json:"task_no"`
	PipelineID  uint                 `json:"pipeline_id"`
	Pipeline    Pipeline             `gorm:"foreignKey:PipelineID" json:"pipeline"`
	InspectorID *uint                `json:"inspector_id"`
	Inspector   *Inspector           `gorm:"foreignKey:InspectorID" json:"inspector"`
	Status      InspectionTaskStatus `gorm:"size:20;default:'PENDING'" json:"status"`
	PlanDate    time.Time            `json:"plan_date"`
	PlanStart   time.Time            `json:"plan_start"`
	PlanEnd     time.Time            `json:"plan_end"`
	ActualStart *time.Time           `json:"actual_start"`
	ActualEnd   *time.Time           `json:"actual_end"`
	AcceptedAt  *time.Time           `json:"accepted_at"`
	Remark      string               `gorm:"type:text" json:"remark"`
	CreatedAt   time.Time            `json:"created_at"`
	UpdatedAt   time.Time            `json:"updated_at"`
}

type RepairTeamStatus string

const (
	TeamStatusIdle     RepairTeamStatus = "IDLE"
	TeamStatusBusy   RepairTeamStatus = "BUSY"
	TeamStatusOnSite RepairTeamStatus = "ON_SITE"
)

type RepairTeam struct {
	ID           uint             `gorm:"primaryKey" json:"id"`
	Name         string           `gorm:"size:50;not null" json:"name"`
	TeamNo       string           `gorm:"size:50;uniqueIndex;not null" json:"team_no"`
	LeaderName     string           `gorm:"size:50" json:"leader_name"`
	Phone        string           `gorm:"size:20" json:"phone"`
	Status       RepairTeamStatus `gorm:"size:20;default:'IDLE'" json:"status"`
	Location     string           `gorm:"size:100" json:"location"`
	CurrentTasks int              `gorm:"default:0" json:"current_tasks"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
}

type AlarmLevel string

const (
	AlarmLevelCritical AlarmLevel = "CRITICAL"
	AlarmLevelMajor    AlarmLevel = "MAJOR"
	AlarmLevelMinor    AlarmLevel = "MINOR"
	AlarmLevelWarning AlarmLevel = "WARNING"
)

type AlarmStatus string

const (
	AlarmStatusNew        AlarmStatus = "NEW"
	AlarmStatusDispatched AlarmStatus = "DISPATCHED"
	AlarmStatusProcessing AlarmStatus = "PROCESSING"
	AlarmStatusResolved  AlarmStatus = "RESOLVED"
	AlarmStatusClosed    AlarmStatus = "CLOSED"
)

type AlarmType string

const (
	AlarmTypePressureHigh AlarmType = "PRESSURE_HIGH"
	AlarmTypePressureLow  AlarmType = "PRESSURE_LOW"
	AlarmTypeLeakage      AlarmType = "LEAKAGE"
	AlarmTypeVolatility    AlarmType = "VOLATILITY"
)

type Alarm struct {
	ID              uint       `gorm:"primaryKey" json:"id"`
	AlarmNo           string     `gorm:"size:50;uniqueIndex;not null" json:"alarm_no"`
	Type              AlarmType  `gorm:"size:30;not null" json:"type"`
	Level             AlarmLevel `gorm:"size:20;not null" json:"level"`
	Status            AlarmStatus `gorm:"size:20;default:'NEW'" json:"status"`
	PipelineID        uint       `json:"pipeline_id"`
	Pipeline          Pipeline   `gorm:"foreignKey:PipelineID" json:"pipeline"`
	PressureDataID        *uint      `json:"pressure_data_id"`
	PressureValue     float64    `json:"pressure_value"`
	Location          string     `gorm:"size:100" json:"location"`
	Description       string     `gorm:"type:text" json:"description"`
	RuleMatched       string     `gorm:"size:200" json:"rule_matched"`
	DispatchedAt      *time.Time `json:"dispatched_at"`
	ResolvedAt        *time.Time `json:"resolved_at"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type RepairOrderStatus string

const (
	RepairStatusPending    RepairOrderStatus = "PENDING"
	RepairStatusDispatched RepairOrderStatus = "DISPATCHED"
	RepairStatusArrived  RepairOrderStatus = "ARRIVED"
	RepairStatusProcessing RepairOrderStatus = "PROCESSING"
	RepairStatusCompleted RepairOrderStatus = "COMPLETED"
)

type RepairOrder struct {
	ID              uint              `gorm:"primaryKey" json:"id"`
	OrderNo         string            `gorm:"size:50;uniqueIndex;not null" json:"order_no"`
	AlarmID         uint              `json:"alarm_id"`
	Alarm           Alarm             `gorm:"foreignKey:AlarmID" json:"alarm"`
	RepairTeamID    uint              `json:"repair_team_id"`
	RepairTeam      RepairTeam        `gorm:"foreignKey:RepairTeamID" json:"repair_team"`
	Status          RepairOrderStatus `gorm:"size:20;default:'PENDING'" json:"status"`
	DispatchReason  string            `gorm:"type:text" json:"dispatch_reason"`
	Distance        float64         `json:"distance"`
	WorkloadScore   float64         `json:"workload_score"`
	ArrivedAt      *time.Time        `json:"arrived_at"`
	CompletedAt    *time.Time        `json:"completed_at"`
	Remark          string            `gorm:"type:text" json:"remark"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

type ValveOperationType string

const (
	ValveOpOpen  ValveOperationType = "OPEN"
	ValveOpClose ValveOperationType = "CLOSE"
	ValveOpAdjust ValveOperationType = "ADJUST"
)

type ValveOperation struct {
	ID           uint                `gorm:"primaryKey" json:"id"`
	OperationNo  string              `gorm:"size:50;uniqueIndex;not null" json:"operation_no"`
	ValveWellID  uint                `json:"valve_well_id"`
	ValveWell    ValveWell           `gorm:"foreignKey:ValveWellID" json:"valve_well"`
	ValveNo      string              `gorm:"size:50;not null" json:"valve_no"`
	OperatorID   uint                `json:"operator_id"`
	OperatorName string              `gorm:"size:50;not null" json:"operator_name"`
	OperationType ValveOperationType `gorm:"size:20;not null" json:"operation_type"`
	Reason        string              `gorm:"type:text;not null" json:"reason"`
	PressureBefore float64         `json:"pressure_before"`
	PressureAfter  float64         `json:"pressure_after"`
	OperationTime  time.Time           `json:"operation_time"`
	Remark        string              `gorm:"type:text" json:"remark"`
	CreatedAt     time.Time           `json:"created_at"`
}

type HazardLevel string

const (
	HazardLevelMajor  HazardLevel = "MAJOR"
	HazardLevelNormal HazardLevel = "NORMAL"
	HazardLevelMinor HazardLevel = "MINOR"
)

type HazardStatus string

const (
	HazardStatusRegistered HazardStatus = "REGISTERED"
	HazardStatusAssigned   HazardStatus = "ASSIGNED"
	HazardStatusRectifying HazardStatus = "RECTIFYING"
	HazardStatusAccepting  HazardStatus = "ACCEPTING"
	HazardStatusClosed   HazardStatus = "CLOSED"
)

type Hazard struct {
	ID             uint         `gorm:"primaryKey" json:"id"`
	HazardNo       string       `gorm:"size:50;uniqueIndex;not null" json:"hazard_no"`
	PipelineID     uint         `json:"pipeline_id"`
	Pipeline       Pipeline     `gorm:"foreignKey:PipelineID" json:"pipeline"`
	InspectorID    uint         `json:"inspector_id"`
	Inspector      Inspector    `gorm:"foreignKey:InspectorID" json:"inspector"`
	Level          HazardLevel  `gorm:"size:20;not null" json:"level"`
	Status         HazardStatus `gorm:"size:20;default:'REGISTERED'" json:"status"`
	Description    string       `gorm:"type:text;not null" json:"description"`
	Location       string       `gorm:"size:100" json:"location"`
	Photos         string       `gorm:"type:text" json:"photos"`
	AssigneeID     *uint        `json:"assignee_id"`
	AssigneeName  *string      `gorm:"size:50" json:"assignee_name"`
	Deadline       *time.Time   `json:"deadline"`
	RectifyDesc   string       `gorm:"type:text" json:"rectify_desc"`
	AcceptResult  *string      `gorm:"type:text" json:"accept_result"`
	RegisteredAt time.Time    `json:"registered_at"`
	AssignedAt   *time.Time   `json:"assigned_at"`
	RectifiedAt  *time.Time   `json:"rectified_at"`
	AcceptedAt *time.Time   `json:"accepted_at"`
	ClosedAt    *time.Time   `json:"closed_at"`
	CreatedAt    time.Time    `json:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at"`
}

type PressureData struct {
	ID                         uint      `gorm:"primaryKey" json:"id"`
	StationID                  uint      `json:"station_id"`
	Station                    PressureRegulatingStation `gorm:"foreignKey:StationID" json:"station"`
	PressureValue              float64   `json:"pressure_value"`
	Timestamp                 time.Time `gorm:"index" json:"timestamp"`
	IsArchived                 bool      `gorm:"default:false" json:"is_archived"`
	CreatedAt                  time.Time `json:"created_at"`
}

type PressureDailyStats struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	StationID      uint      `json:"station_id"`
	StatsDate      time.Time `gorm:"index" json:"stats_date"`
	MaxPressure    float64   `json:"max_pressure"`
	MinPressure    float64   `json:"min_pressure"`
	AvgPressure    float64   `json:"avg_pressure"`
	Volatility     float64   `json:"volatility"`
	SampleCount    int       `json:"sample_count"`
	CreatedAt      time.Time `json:"created_at"`
}

type InspectionTrack struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	TaskID      uint      `json:"task_id"`
	Task        InspectionTask `gorm:"foreignKey:TaskID" json:"task"`
	InspectorID uint      `json:"inspector_id"`
	TrackPoints string    `gorm:"type:text;not null" json:"track_points"`
	SubmitTime  time.Time `json:"submit_time"`
	Deviation   float64   `json:"deviation"`
	IsDeviated  bool      `gorm:"default:false" json:"is_deviated"`
	DeviationPoints string `gorm:"type:text" json:"deviation_points"`
	CreatedAt   time.Time `json:"created_at"`
}

type OperationLog struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     uint      `json:"user_id"`
	UserName   string    `gorm:"size:50" json:"user_name"`
	Operation  string    `gorm:"size:200;not null" json:"operation"`
	Module     string    `gorm:"size:50" json:"module"`
	ResourceID uint      `json:"resource_id"`
	Detail     string    `gorm:"type:text" json:"detail"`
	IPAddress  string    `gorm:"size:50" json:"ip_address"`
	CreatedAt  time.Time `json:"created_at"`
}

type User struct {
	ID       uint      `gorm:"primaryKey" json:"id"`
	Username string    `gorm:"size:50;uniqueIndex;not null" json:"username"`
	Password string    `gorm:"size:100;not null" json:"password"`
	Name     string    `gorm:"size:50" json:"name"`
	Role     string    `gorm:"size:20" json:"role"`
	Phone    string    `gorm:"size:20" json:"phone"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
