package model

import "time"

type User struct {
	ID           int64     `json:"id" db:"id"`
	Username     string    `json:"username" db:"username"`
	PasswordHash string    `json:"-" db:"password_hash"`
	RealName     string    `json:"realName" db:"real_name"`
	Role         Role      `json:"role" db:"role"`
	Email        string    `json:"email" db:"email"`
	Phone        string    `json:"phone" db:"phone"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
	Active       bool      `json:"active" db:"active"`
}

type Recipe struct {
	ID          int64     `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Code        string    `json:"code" db:"code"`
	Version     int       `json:"version" db:"version"`
	Description string    `json:"description" db:"description"`
	Style       string    `json:"style" db:"style"`
	ABVTarget   float64   `json:"abvTarget" db:"abv_target"`
	IBUTarget   float64   `json:"ibuTarget" db:"ibu_target"`
	SRMTarget   float64   `json:"srmTarget" db:"srm_target"`
	CreatedBy   int64     `json:"createdBy" db:"created_by"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	Active      bool      `json:"active" db:"active"`
}

type RecipeIngredient struct {
	ID         int64   `json:"id" db:"id"`
	RecipeID   int64   `json:"recipeId" db:"recipe_id"`
	MaterialID int64   `json:"materialId" db:"material_id"`
	MaterialName string `json:"materialName" db:"material_name"`
	QuantityKg float64 `json:"quantityKg" db:"quantity_kg"`
	Stage      string  `json:"stage" db:"stage"`
	Notes      string  `json:"notes" db:"notes"`
}

type RecipeParam struct {
	ID           int64      `json:"id" db:"id"`
	RecipeID     int64      `json:"recipeId" db:"recipe_id"`
	Stage        BatchStage `json:"stage" db:"stage"`
	ParamName    string     `json:"paramName" db:"param_name"`
	TargetValue  float64    `json:"targetValue" db:"target_value"`
	MinValue     float64    `json:"minValue" db:"min_value"`
	MaxValue     float64    `json:"maxValue" db:"max_value"`
	TolerancePct float64    `json:"tolerancePct" db:"tolerance_pct"`
	Unit         string     `json:"unit" db:"unit"`
	Required     bool       `json:"required" db:"required"`
}

type Batch struct {
	ID             int64       `json:"id" db:"id"`
	BatchNo        string      `json:"batchNo" db:"batch_no"`
	RecipeID       int64       `json:"recipeId" db:"recipe_id"`
	RecipeVersion  int         `json:"recipeVersion" db:"recipe_version"`
	RecipeName     string      `json:"recipeName" db:"recipe_name"`
	CurrentStage   BatchStage  `json:"currentStage" db:"current_stage"`
	Status         BatchStatus `json:"status" db:"status"`
	TargetVolumeL  float64     `json:"targetVolumeL" db:"target_volume_l"`
	ActualVolumeL  float64     `json:"actualVolumeL" db:"actual_volume_l"`
	BrewerID       int64       `json:"brewerId" db:"brewer_id"`
	BrewerName     string      `json:"brewerName" db:"brewer_name"`
	MashingStart   *time.Time  `json:"mashingStart,omitempty" db:"mashing_start"`
	FermentingStart *time.Time `json:"fermentingStart,omitempty" db:"fermenting_start"`
	AgingStart     *time.Time  `json:"agingStart,omitempty" db:"aging_start"`
	BottlingStart  *time.Time  `json:"bottlingStart,omitempty" db:"bottling_start"`
	CompletedAt    *time.Time  `json:"completedAt,omitempty" db:"completed_at"`
	Notes          string      `json:"notes" db:"notes"`
	CreatedAt      time.Time   `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time   `json:"updatedAt" db:"updated_at"`
}

type StageParam struct {
	ID         int64      `json:"id" db:"id"`
	BatchID    int64      `json:"batchId" db:"batch_id"`
	Stage      BatchStage `json:"stage" db:"stage"`
	ParamName  string     `json:"paramName" db:"param_name"`
	ParamValue float64    `json:"paramValue" db:"param_value"`
	Unit       string     `json:"unit" db:"unit"`
	RecordedBy int64      `json:"recordedBy" db:"recorded_by"`
	RecordedAt time.Time  `json:"recordedAt" db:"recorded_at"`
	Notes      string     `json:"notes" db:"notes"`
}

type BatchMaterial struct {
	ID           int64   `json:"id" db:"id"`
	BatchID      int64   `json:"batchId" db:"batch_id"`
	MaterialID   int64   `json:"materialId" db:"material_id"`
	MaterialName string  `json:"materialName" db:"material_name"`
	MaterialLot  string  `json:"materialLot" db:"material_lot"`
	QuantityKg   float64 `json:"quantityKg" db:"quantity_kg"`
	Supplier     string  `json:"supplier" db:"supplier"`
}

type QualityItem struct {
	ID          int64       `json:"id" db:"id"`
	Code        string      `json:"code" db:"code"`
	Name        string      `json:"name" db:"name"`
	Category    string      `json:"category" db:"category"`
	Method      string      `json:"method" db:"method"`
	MinValue    *float64    `json:"minValue,omitempty" db:"min_value"`
	MaxValue    *float64    `json:"maxValue,omitempty" db:"max_value"`
	TargetValue *float64    `json:"targetValue,omitempty" db:"target_value"`
	Unit        string      `json:"unit" db:"unit"`
	Required    bool        `json:"required" db:"required"`
	ApplicableStages string   `json:"applicableStages" db:"applicable_stages"`
	CreatedBy   int64       `json:"createdBy" db:"created_by"`
	CreatedAt   time.Time   `json:"createdAt" db:"created_at"`
	Active      bool        `json:"active" db:"active"`
}

type QualitySample struct {
	ID           int64         `json:"id" db:"id"`
	SampleNo     string        `json:"sampleNo" db:"sample_no"`
	BatchID      int64         `json:"batchId" db:"batch_id"`
	BatchNo      string        `json:"batchNo" db:"batch_no"`
	Stage        BatchStage    `json:"stage" db:"stage"`
	SampledBy    int64         `json:"sampledBy" db:"sampled_by"`
	SampledByName string       `json:"sampledByName" db:"sampled_by_name"`
	SampledAt    time.Time     `json:"sampledAt" db:"sampled_at"`
	Status       QualityStatus `json:"status" db:"status"`
	ReviewedBy   *int64        `json:"reviewedBy,omitempty" db:"reviewed_by"`
	ReviewedAt   *time.Time    `json:"reviewedAt,omitempty" db:"reviewed_at"`
	OverallPass  *bool         `json:"overallPass,omitempty" db:"overall_pass"`
	Notes        string        `json:"notes" db:"notes"`
	RetestOfID   *int64        `json:"retestOfId,omitempty" db:"retest_of_id"`
}

type QualityResult struct {
	ID          int64       `json:"id" db:"id"`
	SampleID    int64       `json:"sampleId" db:"sample_id"`
	ItemID      int64       `json:"itemId" db:"item_id"`
	ItemName    string      `json:"itemName" db:"item_name"`
	ItemCode    string      `json:"itemCode" db:"item_code"`
	ResultValue float64     `json:"resultValue" db:"result_value"`
	Unit        string      `json:"unit" db:"unit"`
	IsPass      *bool       `json:"isPass,omitempty" db:"is_pass"`
	TestedBy    int64       `json:"testedBy" db:"tested_by"`
	TestedAt    time.Time   `json:"testedAt" db:"tested_at"`
	Remarks     string      `json:"remarks" db:"remarks"`
}

type Material struct {
	ID          int64         `json:"id" db:"id"`
	Code        string        `json:"code" db:"code"`
	Name        string        `json:"name" db:"name"`
	Category    string        `json:"category" db:"category"`
	Unit        string        `json:"unit" db:"unit"`
	Supplier    string        `json:"supplier" db:"supplier"`
	Spec        string        `json:"spec" db:"spec"`
	SafetyStock float64       `json:"safetyStock" db:"safety_stock"`
	CreatedAt   time.Time     `json:"createdAt" db:"created_at"`
	Active      bool          `json:"active" db:"active"`
}

type MaterialLot struct {
	ID           int64      `json:"id" db:"id"`
	MaterialID   int64      `json:"materialId" db:"material_id"`
	LotNo        string     `json:"lotNo" db:"lot_no"`
	Quantity     float64    `json:"quantity" db:"quantity"`
	ReceivedDate time.Time  `json:"receivedDate" db:"received_date"`
	ExpiryDate   *time.Time `json:"expiryDate,omitempty" db:"expiry_date"`
	Warehouse    string     `json:"warehouse" db:"warehouse"`
	Location     string     `json:"location" db:"location"`
	Remarks      string     `json:"remarks" db:"remarks"`
	CreatedAt    time.Time  `json:"createdAt" db:"created_at"`
}

type FinishedGoods struct {
	ID          int64     `json:"id" db:"id"`
	BatchID     int64     `json:"batchId" db:"batch_id"`
	BatchNo     string    `json:"batchNo" db:"batch_no"`
	ProductCode string    `json:"productCode" db:"product_code"`
	ProductName string    `json:"productName" db:"product_name"`
	PackageType string    `json:"packageType" db:"package_type"`
	Quantity    int       `json:"quantity" db:"quantity"`
	Unit        string    `json:"unit" db:"unit"`
	VolumeML    int       `json:"volumeMl" db:"volume_ml"`
	Warehouse   string    `json:"warehouse" db:"warehouse"`
	Location    string    `json:"location" db:"location"`
	ProducedAt  time.Time `json:"producedAt" db:"produced_at"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
}

type StockMovement struct {
	ID          int64         `json:"id" db:"id"`
	MoveNo      string        `json:"moveNo" db:"move_no"`
	Type        InventoryType `json:"type" db:"type"`
	Direction   string        `json:"direction" db:"direction"`
	MaterialID  *int64        `json:"materialId,omitempty" db:"material_id"`
	MaterialLot *string       `json:"materialLot,omitempty" db:"material_lot"`
	FinishedID  *int64        `json:"finishedId,omitempty" db:"finished_id"`
	BatchID     *int64        `json:"batchId,omitempty" db:"batch_id"`
	Quantity    float64       `json:"quantity" db:"quantity"`
	RefNo       string        `json:"refNo" db:"ref_no"`
	OperatorID  int64         `json:"operatorId" db:"operator_id"`
	OperatorName string       `json:"operatorName" db:"operator_name"`
	Remarks     string        `json:"remarks" db:"remarks"`
	CreatedAt   time.Time     `json:"createdAt" db:"created_at"`
}

type Alert struct {
	ID        int64       `json:"id" db:"id"`
	AlertType AlertType   `json:"alertType" db:"alert_type"`
	Level     AlertLevel  `json:"level" db:"level"`
	Title     string      `json:"title" db:"title"`
	Message   string      `json:"message" db:"message"`
	BatchID   *int64      `json:"batchId,omitempty" db:"batch_id"`
	BatchNo   *string     `json:"batchNo,omitempty" db:"batch_no"`
	RefType   string      `json:"refType" db:"ref_type"`
	RefID     int64       `json:"refId" db:"ref_id"`
	Resolved  bool        `json:"resolved" db:"resolved"`
	ResolvedBy *int64      `json:"resolvedBy,omitempty" db:"resolved_by"`
	ResolvedAt *time.Time  `json:"resolvedAt,omitempty" db:"resolved_at"`
	ResolvedNote string    `json:"resolvedNote,omitempty" db:"resolved_note"`
	CreatedAt time.Time   `json:"createdAt" db:"created_at"`
}

type DeviationLog struct {
	ID            int64      `json:"id" db:"id"`
	BatchID       int64      `json:"batchId" db:"batch_id"`
	BatchNo       string     `json:"batchNo" db:"batch_no"`
	Stage         BatchStage `json:"stage" db:"stage"`
	ParamName     string     `json:"paramName" db:"param_name"`
	StandardValue float64    `json:"standardValue" db:"standard_value"`
	ActualValue   float64    `json:"actualValue" db:"actual_value"`
	DeviationPct  float64    `json:"deviationPct" db:"deviation_pct"`
	ThresholdPct  float64    `json:"thresholdPct" db:"threshold_pct"`
	Handled       bool       `json:"handled" db:"handled"`
	HandlerID     *int64     `json:"handlerId,omitempty" db:"handler_id"`
	HandleNote    string     `json:"handleNote,omitempty" db:"handle_note"`
	HandledAt     *time.Time `json:"handledAt,omitempty" db:"handled_at"`
	CreatedAt     time.Time  `json:"createdAt" db:"created_at"`
}

type AsyncTask struct {
	ID         string     `json:"id" db:"id"`
	TaskType   string     `json:"taskType" db:"task_type"`
	Status     TaskStatus `json:"status" db:"status"`
	Progress   int        `json:"progress" db:"progress"`
	Result     string     `json:"result,omitempty" db:"result"`
	ErrorMsg   string     `json:"errorMsg,omitempty" db:"error_msg"`
	CreatedBy  int64      `json:"createdBy" db:"created_by"`
	CreatedAt  time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt  time.Time  `json:"updatedAt" db:"updated_at"`
}

type ComplianceReport struct {
	ID           int64     `json:"id" db:"id"`
	ReportNo     string    `json:"reportNo" db:"report_no"`
	ReportType   string    `json:"reportType" db:"report_type"`
	BatchID      int64     `json:"batchId" db:"batch_id"`
	BatchNo      string    `json:"batchNo" db:"batch_no"`
	ContentJSON  string    `json:"-" db:"content_json"`
	FileURL      string    `json:"fileUrl,omitempty" db:"file_url"`
	GeneratedBy  int64     `json:"generatedBy" db:"generated_by"`
	GeneratedAt  time.Time `json:"generatedAt" db:"generated_at"`
}
