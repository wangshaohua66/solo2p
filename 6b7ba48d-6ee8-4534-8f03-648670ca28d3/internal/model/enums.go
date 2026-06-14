package model

type BatchStage string

const (
	StageMashing    BatchStage = "mashing"
	StageFermenting BatchStage = "fermenting"
	StageAging      BatchStage = "aging"
	StageBottling   BatchStage = "bottling"
	StageCompleted  BatchStage = "completed"
	StageFrozen     BatchStage = "frozen"
	StageRejected   BatchStage = "rejected"
)

type BatchStatus string

const (
	BatchStatusActive    BatchStatus = "active"
	BatchStatusFrozen    BatchStatus = "frozen"
	BatchStatusCompleted BatchStatus = "completed"
	BatchStatusRejected  BatchStatus = "rejected"
)

type QualityStatus string

const (
	QualityPending  QualityStatus = "pending"
	QualityPassed   QualityStatus = "passed"
	QualityFailed   QualityStatus = "failed"
	QualityRetest   QualityStatus = "retest"
	QualityReviewed QualityStatus = "reviewed"
)

type InventoryType string

const (
	InventoryRawMaterial InventoryType = "raw_material"
	InventoryFinished    InventoryType = "finished"
)

type AlertLevel string

const (
	AlertLevelInfo     AlertLevel = "info"
	AlertLevelWarning  AlertLevel = "warning"
	AlertLevelCritical AlertLevel = "critical"
)

type AlertType string

const (
	AlertTypeDeviation AlertType = "deviation"
	AlertTypeInventory AlertType = "inventory"
	AlertTypeQuality   AlertType = "quality"
	AlertTypeExpiry    AlertType = "expiry"
)

type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
)

type Role string

const (
	RoleBrewer     Role = "brewer"
	RoleQC         Role = "qc"
	RoleWarehouse  Role = "warehouse"
	RoleCompliance Role = "compliance"
	RoleAdmin      Role = "admin"
)

func (r Role) String() string { return string(r) }

var ValidRoles = map[Role]bool{
	RoleBrewer:     true,
	RoleQC:         true,
	RoleWarehouse:  true,
	RoleCompliance: true,
	RoleAdmin:      true,
}

var StageOrder = map[BatchStage]int{
	StageMashing:    1,
	StageFermenting: 2,
	StageAging:      3,
	StageBottling:   4,
	StageCompleted:  5,
}

func CanTransition(from, to BatchStage) bool {
	fromOrder, fromOk := StageOrder[from]
	toOrder, toOk := StageOrder[to]
	if !fromOk || !toOk {
		return false
	}
	return toOrder == fromOrder+1
}
