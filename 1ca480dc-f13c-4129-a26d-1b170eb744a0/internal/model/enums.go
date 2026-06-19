package model

type ContainerType string

const (
	ContainerTypeNormal    ContainerType = "NORMAL"
	ContainerTypeReefer    ContainerType = "REEFER"
	ContainerTypeDangerous ContainerType = "DANGEROUS"
	ContainerTypeOversize  ContainerType = "OVERSIZE"
)

type ContainerSize string

const (
	ContainerSize20FT ContainerSize = "20FT"
	ContainerSize40FT ContainerSize = "40FT"
	ContainerSize45FT ContainerSize = "45FT"
)

type ContainerStatus string

const (
	ContainerStatusInYard   ContainerStatus = "IN_YARD"
	ContainerStatusLoading  ContainerStatus = "LOADING"
	ContainerStatusUnloading ContainerStatus = "UNLOADING"
	ContainerStatusOutYard  ContainerStatus = "OUT_YARD"
)

type WeightLevel string

const (
	WeightLevelLight  WeightLevel = "LIGHT"
	WeightLevelMedium WeightLevel = "MEDIUM"
	WeightLevelHeavy  WeightLevel = "HEAVY"
)

type BerthStatus string

const (
	BerthStatusIdle     BerthStatus = "IDLE"
	BerthStatusOccupied BerthStatus = "OCCUPIED"
	BerthStatusReserved BerthStatus = "RESERVED"
	BerthStatusMaintenance BerthStatus = "MAINTENANCE"
)

type QuayCraneStatus string

const (
	QuayCraneStatusIdle      QuayCraneStatus = "IDLE"
	QuayCraneStatusWorking   QuayCraneStatus = "WORKING"
	QuayCraneStatusMaintenance QuayCraneStatus = "MAINTENANCE"
)

type AppointmentStatus string

const (
	AppointmentStatusPending   AppointmentStatus = "PENDING"
	AppointmentStatusConfirmed AppointmentStatus = "CONFIRMED"
	AppointmentStatusCheckedIn AppointmentStatus = "CHECKED_IN"
	AppointmentStatusCompleted AppointmentStatus = "COMPLETED"
	AppointmentStatusCancelled AppointmentStatus = "CANCELLED"
	AppointmentStatusTimeout   AppointmentStatus = "TIMEOUT"
)

type AlertLevel string

const (
	AlertLevelInfo    AlertLevel = "INFO"
	AlertLevelWarning AlertLevel = "WARNING"
	AlertLevelCritical AlertLevel = "CRITICAL"
)

type AlertStatus string

const (
	AlertStatusPending  AlertStatus = "PENDING"
	AlertStatusHandled  AlertStatus = "HANDLED"
	AlertStatusEscalated AlertStatus = "ESCALATED"
	AlertStatusClosed   AlertStatus = "CLOSED"
)

type CustomsStatus string

const (
	CustomsStatusPending    CustomsStatus = "PENDING"
	CustomsStatusDeclared   CustomsStatus = "DECLARED"
	CustomsStatusInspecting CustomsStatus = "INSPECTING"
	CustomsStatusPassed     CustomsStatus = "PASSED"
	CustomsStatusRejected   CustomsStatus = "REJECTED"
)

type BillingStatus string

const (
	BillingStatusUnpaid   BillingStatus = "UNPAID"
	BillingStatusPartial  BillingStatus = "PARTIAL"
	BillingStatusPaid     BillingStatus = "PAID"
	BillingStatusOverdue  BillingStatus = "OVERDUE"
)

type DangerousClass string

const (
	DangerousClass1 DangerousClass = "CLASS_1"
	DangerousClass2 DangerousClass = "CLASS_2"
	DangerousClass3 DangerousClass = "CLASS_3"
	DangerousClass4 DangerousClass = "CLASS_4"
	DangerousClass5 DangerousClass = "CLASS_5"
	DangerousClass6 DangerousClass = "CLASS_6"
	DangerousClass7 DangerousClass = "CLASS_7"
	DangerousClass8 DangerousClass = "CLASS_8"
	DangerousClass9 DangerousClass = "CLASS_9"
)
