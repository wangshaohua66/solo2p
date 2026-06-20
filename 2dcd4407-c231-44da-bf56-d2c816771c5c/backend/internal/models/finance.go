package models

type FinanceType string

const (
	FinanceTypeIncome  FinanceType = "income"
	FinanceTypeExpense FinanceType = "expense"
	FinanceTypeDeposit FinanceType = "deposit"
	FinanceTypeRefund  FinanceType = "refund"
)

type FinanceStatus string

const (
	FinanceStatusPending   FinanceStatus = "pending"
	FinanceStatusConfirmed FinanceStatus = "confirmed"
	FinanceStatusCancelled FinanceStatus = "cancelled"
)

type FinanceRecord struct {
	BaseModel
	Type            FinanceType   `json:"type" gorm:"size:20;not null" example:"income"`
	Title           string        `json:"title" gorm:"size:200;not null" example:"展位费收入"`
	Amount          float64       `json:"amount" gorm:"type:decimal(14,2);not null" example:"150000.00"`
	Currency        string        `json:"currency" gorm:"size:10;default:CNY" example:"CNY"`
	Status          FinanceStatus `json:"status" gorm:"size:20;default:pending" example:"pending"`
	ScheduleID      string        `json:"scheduleId" gorm:"type:uuid"`
	ScheduleName    string        `json:"scheduleName" gorm:"size:200"`
	ContractID      string        `json:"contractId" gorm:"type:uuid"`
	ContractNo      string        `json:"contractNo" gorm:"size:50"`
	PartyName       string        `json:"partyName" gorm:"size:200"`
	PaymentMethod   string        `json:"paymentMethod" gorm:"size:50" example:"bank_transfer"`
	TransactionNo   string        `json:"transactionNo" gorm:"size:100"`
	InvoiceNo       string        `json:"invoiceNo" gorm:"size:50"`
	InvoiceURL      string        `json:"invoiceUrl" gorm:"size:500"`
	ConfirmedBy     string        `json:"confirmedBy" gorm:"size:100"`
	ConfirmedAt     string        `json:"confirmedAt" gorm:"size:30"`
	Remark          string        `json:"remark" gorm:"type:text"`
	OperatorID      string        `json:"operatorId" gorm:"type:uuid"`
	OperatorName    string        `json:"operatorName" gorm:"size:100"`
	Category        string        `json:"category" gorm:"size:50"`
}

func (FinanceRecord) TableName() string {
	return "finance_records"
}

type DepositStatus string

const (
	DepositStatusUnrefunded DepositStatus = "unrefunded"
	DepositStatusPartial    DepositStatus = "partial"
	DepositStatusRefunded   DepositStatus = "refunded"
)

type DepositRecord struct {
	BaseModel
	ContractID     string        `json:"contractId" gorm:"type:uuid"`
	ContractNo     string        `json:"contractNo" gorm:"size:50"`
	PartyName      string        `json:"partyName" gorm:"size:200"`
	DepositedAmount float64      `json:"depositedAmount" gorm:"type:decimal(14,2)" example:"150000.00"`
	RefundableAmount float64     `json:"refundableAmount" gorm:"type:decimal(14,2)" example:"150000.00"`
	RefundedAmount float64       `json:"refundedAmount" gorm:"type:decimal(14,2);default:0" example:"0"`
	Status         DepositStatus `json:"status" gorm:"size:20;default:unrefunded" example:"unrefunded"`
	DepositedAt    string        `json:"depositedAt" gorm:"size:30"`
	RefundDate     string        `json:"refundDate" gorm:"size:30"`
	Remark         string        `json:"remark" gorm:"type:text"`
}

func (DepositRecord) TableName() string {
	return "deposit_records"
}

type FinanceSummary struct {
	TotalIncome   float64 `json:"totalIncome"`
	TotalExpense  float64 `json:"totalExpense"`
	TotalDeposit  float64 `json:"totalDeposit"`
	TotalRefund   float64 `json:"totalRefund"`
	NetProfit     float64 `json:"netProfit"`
}

type MergeSettleResult struct {
	TotalAmount   float64         `json:"totalAmount"`
	IncomeAmount  float64         `json:"incomeAmount"`
	ExpenseAmount float64         `json:"expenseAmount"`
	DepositAmount float64         `json:"depositAmount"`
	Records       []FinanceRecord `json:"records"`
}
