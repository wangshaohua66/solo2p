package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type Station struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name      string    `gorm:"type:varchar(100);not null" json:"name"`
	Address   string    `gorm:"type:varchar(255)" json:"address"`
	Lat       float64   `gorm:"type:decimal(10,7)" json:"lat"`
	Lng       float64   `gorm:"type:decimal(10,7)" json:"lng"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Doctor struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	StationID  uuid.UUID      `gorm:"type:uuid;not null" json:"stationId"`
	Station    Station        `gorm:"foreignKey:StationID" json:"station"`
	Name       string         `gorm:"type:varchar(50);not null" json:"name"`
	Gender     string         `gorm:"type:varchar(10)" json:"gender"`
	Title      string         `gorm:"type:varchar(50)" json:"title"`
	Department string        `gorm:"type:varchar(50)" json:"department"`
	Languages  string         `gorm:"type:varchar(100)" json:"languages"`
	Schedule   datatypes.JSON `gorm:"type:jsonb" json:"schedule"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
}

type Patient struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	StationID        uuid.UUID `gorm:"type:uuid;not null" json:"stationId"`
	Station          Station   `gorm:"foreignKey:StationID" json:"station"`
	Name             string    `gorm:"type:varchar(50);not null;index" json:"name"`
	Gender           string    `gorm:"type:varchar(10)" json:"gender"`
	BirthDate        time.Time `gorm:"type:date" json:"birthDate"`
	IDCard           string    `gorm:"type:varchar(20);uniqueIndex" json:"idCard"`
	Phone            string    `gorm:"type:varchar(20);index" json:"phone"`
	Address          string    `gorm:"type:varchar(255)" json:"address"`
	Lat              float64   `gorm:"type:decimal(10,7)" json:"lat"`
	Lng              float64   `gorm:"type:decimal(10,7)" json:"lng"`
	EmergencyContact string    `gorm:"type:varchar(50)" json:"emergencyContact"`
	EmergencyPhone   string    `gorm:"type:varchar(20)" json:"emergencyPhone"`
	RiskScore        int       `gorm:"type:int;default:0" json:"riskScore"`
	RiskLevel        string    `gorm:"type:varchar(10);default:'low';index" json:"riskLevel"`
	MedicalHistory   string    `gorm:"type:text" json:"medicalHistory"`
	AllergyHistory   string    `gorm:"type:text" json:"allergyHistory"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

type Appointment struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PatientID     uuid.UUID `gorm:"type:uuid;not null;index" json:"patientId"`
	Patient       Patient   `gorm:"foreignKey:PatientID" json:"patient"`
	DoctorID      uuid.UUID `gorm:"type:uuid;not null;index" json:"doctorId"`
	Doctor        Doctor    `gorm:"foreignKey:DoctorID" json:"doctor"`
	StationID     uuid.UUID `gorm:"type:uuid;not null" json:"stationId"`
	Department    string    `gorm:"type:varchar(50)" json:"department"`
	AppointmentDate time.Time `gorm:"type:date;index:idx_appointment_doctor_date" json:"date"`
	TimeSlot      string    `gorm:"type:varchar(20)" json:"timeSlot"`
	Status        string    `gorm:"type:varchar(20);default:'pending';index" json:"status"`
	MatchScore    int       `gorm:"type:int" json:"matchScore"`
	MatchReasons  string    `gorm:"type:text" json:"matchReasons"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type DiagnosisRecord struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PatientID     uuid.UUID `gorm:"type:uuid;not null;index" json:"patientId"`
	Patient       Patient   `gorm:"foreignKey:PatientID" json:"-"`
	DoctorID      uuid.UUID `gorm:"type:uuid;not null" json:"doctorId"`
	DoctorName    string    `gorm:"type:varchar(50)" json:"doctorName"`
	DiagnosisDate time.Time `gorm:"type:date" json:"diagnosisDate"`
	Diagnosis     string    `gorm:"type:text;not null" json:"diagnosis"`
	IcdCode       string    `gorm:"type:varchar(20)" json:"icdCode"`
	Notes         string    `gorm:"type:text" json:"notes"`
	CreatedAt     time.Time `json:"createdAt"`
}

type Medication struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PatientID        uuid.UUID `gorm:"type:uuid;not null;index" json:"patientId"`
	DrugName         string    `gorm:"type:varchar(100);not null" json:"drugName"`
	Dosage           string    `gorm:"type:varchar(50)" json:"dosage"`
	Frequency        string    `gorm:"type:varchar(50)" json:"frequency"`
	StartDate        time.Time `gorm:"type:date" json:"startDate"`
	EndDate          *time.Time `gorm:"type:date" json:"endDate,omitempty"`
	AdherencePercent int       `gorm:"type:int;default:100" json:"adherence"`
	Notes            string    `gorm:"type:text" json:"notes"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type Assessment struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PatientID  uuid.UUID      `gorm:"type:uuid;not null;index:idx_assessment_patient_scale" json:"patientId"`
	ScaleCode  string         `gorm:"type:varchar(20);not null;index:idx_assessment_patient_scale" json:"scaleCode"`
	ScaleName  string         `gorm:"type:varchar(100);not null" json:"scaleName"`
	TotalScore int            `gorm:"type:int;not null" json:"totalScore"`
	Severity   string         `gorm:"type:varchar(20)" json:"severity"`
	Answers    datatypes.JSON `gorm:"type:jsonb" json:"answers"`
	AssessorID uuid.UUID      `gorm:"type:uuid" json:"assessorId"`
	AssessedAt time.Time      `gorm:"index" json:"assessedAt"`
	CreatedAt  time.Time      `json:"createdAt"`
}

type Warning struct {
	ID              uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PatientID       uuid.UUID      `gorm:"type:uuid;not null;index" json:"patientId"`
	Patient         Patient        `gorm:"foreignKey:PatientID" json:"patient"`
	RiskScore       int            `gorm:"type:int;not null" json:"riskScore"`
	RiskLevel       string         `gorm:"type:varchar(10);not null;index" json:"riskLevel"`
	TriggerFactors  datatypes.JSON `gorm:"type:jsonb" json:"triggerFactors"`
	Status          string         `gorm:"type:varchar(20);default:'pending';index" json:"status"`
	AssigneeID      *uuid.UUID     `gorm:"type:uuid" json:"assigneeId,omitempty"`
	AssigneeName    string         `gorm:"type:varchar(50)" json:"assigneeName,omitempty"`
	NotifiedDoctors datatypes.JSON `gorm:"type:jsonb" json:"notifiedDoctors"`
	FamilyNotified  bool           `gorm:"default:false" json:"notifiedFamily"`
	CreatedAt       time.Time      `gorm:"index:idx_warning_created" json:"createdAt"`
	ResolvedAt      *time.Time     `json:"resolvedAt,omitempty"`
	Resolution      string         `gorm:"type:text" json:"resolution,omitempty"`
}

type WarningLog struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WarningID  uuid.UUID `gorm:"type:uuid;not null" json:"warningId"`
	Warning    Warning   `gorm:"foreignKey:WarningID" json:"-"`
	Action     string    `gorm:"type:varchar(50)" json:"action"`
	OperatorID uuid.UUID `gorm:"type:uuid" json:"operatorId"`
	Detail     string    `gorm:"type:text" json:"detail"`
	CreatedAt  time.Time `json:"createdAt"`
}

type Followup struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PatientID   uuid.UUID `gorm:"type:uuid;not null;index" json:"patientId"`
	DoctorID    uuid.UUID `gorm:"type:uuid;not null" json:"doctorId"`
	PlannedDate time.Time `gorm:"type:date" json:"plannedDate"`
	Status      string    `gorm:"type:varchar(20);default:'pending'" json:"status"`
	Content     string    `gorm:"type:text" json:"content"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Referral struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PatientID      uuid.UUID  `gorm:"type:uuid;not null" json:"patientId"`
	FromStationID  uuid.UUID  `gorm:"type:uuid;not null" json:"fromStationId"`
	ToStationID    uuid.UUID  `gorm:"type:uuid;not null" json:"toStationId"`
	FromDoctorID   uuid.UUID  `gorm:"type:uuid;not null" json:"fromDoctorId"`
	Status         string     `gorm:"type:varchar(20);default:'pending'" json:"status"`
	Reason         string     `gorm:"type:text" json:"reason"`
	RejectReason   string     `gorm:"type:text" json:"rejectReason,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	AcceptedAt     *time.Time `json:"acceptedAt,omitempty"`
}

type AuditLog struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID       uuid.UUID `gorm:"type:uuid;index" json:"userId"`
	Action       string    `gorm:"type:varchar(50);index" json:"action"`
	ResourceType string    `gorm:"type:varchar(50)" json:"resourceType"`
	ResourceID   uuid.UUID `gorm:"type:uuid" json:"resourceId"`
	IPAddress    string    `gorm:"type:varchar(50)" json:"ipAddress"`
	Detail       string    `gorm:"type:text" json:"detail"`
	CreatedAt    time.Time `gorm:"index" json:"createdAt"`
}

type User struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Username  string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"username"`
	Password  string    `gorm:"type:varchar(255);not null" json:"-"`
	Name      string    `gorm:"type:varchar(50);not null" json:"name"`
	Role      string    `gorm:"type:varchar(20);not null" json:"role"`
	StationID uuid.UUID `gorm:"type:uuid" json:"stationId"`
	Phone     string    `gorm:"type:varchar(20)" json:"phone"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&Station{},
		&Doctor{},
		&Patient{},
		&Appointment{},
		&DiagnosisRecord{},
		&Medication{},
		&Assessment{},
		&Warning{},
		&WarningLog{},
		&Followup{},
		&Referral{},
		&AuditLog{},
		&User{},
	)
}
