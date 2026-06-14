package dto

import (
	"craftbrew-tracker/internal/model"
	"time"
)

type LoginRequest struct {
	Username string `json:"username" validate:"required,min=3,max=50"`
	Password string `json:"password" validate:"required,min=6"`
}

type LoginResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
	User      *UserInfo `json:"user"`
}

type UserInfo struct {
	ID       int64      `json:"id"`
	Username string     `json:"username"`
	RealName string     `json:"realName"`
	Role     model.Role `json:"role"`
	Email    string     `json:"email"`
}

type CreateUserRequest struct {
	Username string     `json:"username" validate:"required,min=3,max=50"`
	Password string     `json:"password" validate:"required,min=6"`
	RealName string     `json:"realName" validate:"required"`
	Role     model.Role `json:"role" validate:"required"`
	Email    string     `json:"email"`
	Phone    string     `json:"phone"`
}

type PaginationParams struct {
	Page     int `query:"page" json:"page"`
	PageSize int `query:"pageSize" json:"pageSize"`
}

func (p PaginationParams) Normalize() (int, int) {
	page := p.Page
	if page <= 0 {
		page = 1
	}
	size := p.PageSize
	if size <= 0 {
		size = 20
	}
	if size > 100 {
		size = 100
	}
	return page, size
}

func (p PaginationParams) Offset() int {
	page, size := p.Normalize()
	return (page - 1) * size
}

func (p PaginationParams) Limit() int {
	_, size := p.Normalize()
	return size
}

type CreateBatchRequest struct {
	RecipeID      int64   `json:"recipeId" validate:"required,min=1"`
	TargetVolumeL float64 `json:"targetVolumeL" validate:"required,min=1"`
	Notes         string  `json:"notes"`
}

type TransitionStageRequest struct {
	ToStage model.BatchStage `json:"toStage" validate:"required"`
	Notes   string           `json:"notes"`
}

type RecordParamRequest struct {
	Stage      model.BatchStage `json:"stage" validate:"required"`
	ParamName  string           `json:"paramName" validate:"required"`
	ParamValue float64          `json:"paramValue" validate:"required"`
	Unit       string           `json:"unit"`
	Notes      string           `json:"notes"`
}

type CreateRecipeRequest struct {
	Name        string               `json:"name" validate:"required"`
	Code        string               `json:"code" validate:"required"`
	Description string               `json:"description"`
	Style       string               `json:"style"`
	ABVTarget   float64              `json:"abvTarget"`
	IBUTarget   float64              `json:"ibuTarget"`
	SRMTarget   float64              `json:"srmTarget"`
	Ingredients []RecipeIngredientIn `json:"ingredients"`
	Params      []RecipeParamIn      `json:"params"`
}

type RecipeIngredientIn struct {
	MaterialID   int64   `json:"materialId" validate:"required"`
	MaterialName string  `json:"materialName" validate:"required"`
	QuantityKg   float64 `json:"quantityKg" validate:"required,min=0"`
	Stage        string  `json:"stage"`
	Notes        string  `json:"notes"`
}

type RecipeParamIn struct {
	Stage        model.BatchStage `json:"stage" validate:"required"`
	ParamName    string           `json:"paramName" validate:"required"`
	TargetValue  float64          `json:"targetValue"`
	MinValue     float64          `json:"minValue"`
	MaxValue     float64          `json:"maxValue"`
	TolerancePct float64          `json:"tolerancePct"`
	Unit         string           `json:"unit"`
	Required     bool             `json:"required"`
}

type CreateQualityItemRequest struct {
	Code             string  `json:"code" validate:"required"`
	Name             string  `json:"name" validate:"required"`
	Category         string  `json:"category"`
	Method           string  `json:"method"`
	MinValue         float64 `json:"minValue"`
	MaxValue         float64 `json:"maxValue"`
	TargetValue      float64 `json:"targetValue"`
	Unit             string  `json:"unit"`
	Required         bool    `json:"required"`
	ApplicableStages string  `json:"applicableStages"`
}

type SubmitSampleRequest struct {
	BatchID    int64            `json:"batchId" validate:"required"`
	Stage      model.BatchStage `json:"stage" validate:"required"`
	Results    []SampleResultIn `json:"results" validate:"required,min=1"`
	Notes      string           `json:"notes"`
}

type SampleResultIn struct {
	ItemID      int64   `json:"itemId" validate:"required"`
	ResultValue float64 `json:"resultValue" validate:"required"`
	Remarks     string  `json:"remarks"`
}

type ReviewSampleRequest struct {
	OverallPass bool   `json:"overallPass"`
	FreezeBatch *bool  `json:"freezeBatch"`
	Retest      *bool  `json:"retest"`
	Notes       string `json:"notes"`
}

type RawMaterialInboundRequest struct {
	MaterialID int64      `json:"materialId" validate:"required"`
	LotNo      string     `json:"lotNo" validate:"required"`
	Quantity   float64    `json:"quantity" validate:"required,min=0"`
	Supplier   string     `json:"supplier"`
	Spec       string     `json:"spec"`
	ReceivedDate time.Time `json:"receivedDate"`
	ExpiryDate *time.Time `json:"expiryDate"`
	Warehouse  string     `json:"warehouse"`
	Location   string     `json:"location"`
	RefNo      string     `json:"refNo"`
	Remarks    string     `json:"remarks"`
}

type FinishedGoodsInboundRequest struct {
	BatchID     int64  `json:"batchId" validate:"required"`
	ProductCode string `json:"productCode" validate:"required"`
	ProductName string `json:"productName" validate:"required"`
	PackageType string `json:"packageType"`
	Quantity    int    `json:"quantity" validate:"required,min=1"`
	Unit        string `json:"unit"`
	VolumeML    int    `json:"volumeMl"`
	Warehouse   string `json:"warehouse"`
	Location    string `json:"location"`
	Remarks     string `json:"remarks"`
}

type FinishedGoodsOutboundRequest struct {
	FinishedID []int64 `json:"finishedIds" validate:"required,min=1"`
	Quantity   []int   `json:"quantities" validate:"required,min=1"`
	RefNo      string  `json:"refNo"`
	Remarks    string  `json:"remarks"`
}

type TraceQueryRequest struct {
	BatchNo    string           `query:"batchNo"`
	StartDate  *time.Time       `query:"startDate"`
	EndDate    *time.Time       `query:"endDate"`
	Stage      model.BatchStage `query:"stage"`
	QualityStatus model.QualityStatus `query:"qualityStatus"`
	Page       int              `query:"page"`
	PageSize   int              `query:"pageSize"`
}

type TraceChainResponse struct {
	Batch         *model.Batch          `json:"batch"`
	Recipe        *model.Recipe         `json:"recipe"`
	Materials     []*model.BatchMaterial `json:"materials"`
	Stages        []StageInfo           `json:"stages"`
	QualitySamples []*SampleInfo        `json:"qualitySamples"`
	Movements     []*StockMovementInfo  `json:"movements"`
	Deviations    []*DeviationInfo      `json:"deviations"`
}

type StageInfo struct {
	Stage      model.BatchStage    `json:"stage"`
	StartedAt  *time.Time          `json:"startedAt"`
	Params     []*model.StageParam `json:"params"`
	Completed  bool                `json:"completed"`
}

type SampleInfo struct {
	Sample  *model.QualitySample  `json:"sample"`
	Results []*model.QualityResult `json:"results"`
}

type StockMovementInfo struct {
	Movement *model.StockMovement `json:"movement"`
}

type DeviationInfo struct {
	Log *model.DeviationLog `json:"log"`
}

type ExportReportRequest struct {
	BatchID    int64      `json:"batchId" validate:"required"`
	ReportType string     `json:"reportType" validate:"required"`
	Template   string     `json:"template"`
}

type CreateMaterialRequest struct {
	Code        string  `json:"code" validate:"required"`
	Name        string  `json:"name" validate:"required"`
	Category    string  `json:"category"`
	Unit        string  `json:"unit"`
	Supplier    string  `json:"supplier"`
	Spec        string  `json:"spec"`
	SafetyStock float64 `json:"safetyStock"`
}

type AlertResolveRequest struct {
	Note string `json:"note" validate:"required"`
}

type BatchMaterialIn struct {
	MaterialID   int64   `json:"materialId" validate:"required"`
	MaterialName string  `json:"materialName" validate:"required"`
	MaterialLot  string  `json:"materialLot" validate:"required"`
	QuantityKg   float64 `json:"quantityKg" validate:"required,min=0"`
	Supplier     string  `json:"supplier"`
}

type LinkMaterialRequest struct {
	Materials []BatchMaterialIn `json:"materials" validate:"required,min=1"`
}
