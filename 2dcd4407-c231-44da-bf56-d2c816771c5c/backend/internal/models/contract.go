package models

type ContractStatus string

const (
	ContractStatusDraft     ContractStatus = "draft"
	ContractStatusReviewing ContractStatus = "reviewing"
	ContractStatusApproved  ContractStatus = "approved"
	ContractStatusRejected  ContractStatus = "rejected"
	ContractStatusSigned    ContractStatus = "signed"
	ContractStatusArchived  ContractStatus = "archived"
)

type ApprovalStep struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	ApproverID string `json:"approverId"`
	Approver   string `json:"approver"`
	Status     string `json:"status"`
	Comment    string `json:"comment"`
	ApprovedAt string `json:"approvedAt"`
	Order      int    `json:"order"`
}

type Contract struct {
	BaseModel
	ContractNo    string         `json:"contractNo" gorm:"size:50;uniqueIndex" example:"HT-2026-001"`
	ScheduleID    string         `json:"scheduleId" gorm:"type:uuid"`
	ScheduleName  string         `json:"scheduleName" gorm:"size:200" example:"2026国际建材博览会"`
	PartyA        string         `json:"partyA" gorm:"size:200" example:"某市国际会展中心有限公司"`
	PartyB        string         `json:"partyB" gorm:"size:200;not null" example:"中国建筑材料联合会"`
	PartyBContact string         `json:"partyBContact" gorm:"size:100"`
	PartyBPhone   string         `json:"partyBPhone" gorm:"size:20"`
	Amount        float64        `json:"amount" gorm:"type:decimal(14,2)" example:"500000.00"`
	DepositRate   float64        `json:"depositRate" example:"30"`
	DepositAmount float64        `json:"depositAmount" gorm:"type:decimal(14,2)" example:"150000.00"`
	TemplateID    string         `json:"templateId" gorm:"type:uuid"`
	Status        ContractStatus `json:"status" gorm:"size:20;default:draft" example:"draft"`
	CurrentStep   int            `json:"currentStep" example:"0"`
	ApprovalFlow  []ApprovalStep `json:"approvalFlow" gorm:"type:jsonb"`
	SignedURL     string         `json:"signedUrl" gorm:"size:500"`
	SignedAt      string         `json:"signedAt" gorm:"size:30"`
	ArchiveNo     string         `json:"archiveNo" gorm:"size:50"`
	EffectiveDate string         `json:"effectiveDate" gorm:"size:10"`
	ExpireDate    string         `json:"expireDate" gorm:"size:10"`
	Content       string         `json:"content" gorm:"type:text"`
	AttachmentURL string         `json:"attachmentUrl" gorm:"size:500"`
}

func (Contract) TableName() string {
	return "contracts"
}

type ContractTemplate struct {
	BaseModel
	Name               string   `json:"name" gorm:"size:200;not null"`
	Type               string   `json:"type" gorm:"size:50"`
	Content            string   `json:"content" gorm:"type:text"`
	DefaultDepositRate float64  `json:"defaultDepositRate"`
	Fields             []string `json:"fields" gorm:"type:jsonb"`
	Status             string   `json:"status" gorm:"size:20;default:active"`
}

func (ContractTemplate) TableName() string {
	return "contract_templates"
}
