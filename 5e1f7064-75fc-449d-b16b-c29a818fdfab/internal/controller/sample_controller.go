package controller

import (
	"github.com/gin-gonic/gin"
	"lab-management/internal/dto"
	appErr "lab-management/internal/pkg/errors"
	"lab-management/internal/pkg/response"
	"lab-management/internal/service"
)

type SampleController struct {
	*BaseController
	sampleService       *service.SampleService
	testResultService   *service.TestResultService
	criticalValueService *service.CriticalValueService
}

func NewSampleController(
	base *BaseController,
	sampleService *service.SampleService,
	testResultService *service.TestResultService,
	criticalValueService *service.CriticalValueService,
) *SampleController {
	return &SampleController{
		BaseController:       base,
		sampleService:        sampleService,
		testResultService:    testResultService,
		criticalValueService: criticalValueService,
	}
}

func (c *SampleController) CreateSample(ctx *gin.Context) {
	var req dto.CreateSampleRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	userID := getCurrentUserID(ctx)
	barcode, ec := c.sampleService.Create(&req, userID)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, gin.H{"barcode": barcode})
}

func (c *SampleController) BatchCreateSample(ctx *gin.Context) {
	var req dto.BatchCreateSampleRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	userID := getCurrentUserID(ctx)
	barcodes, ec := c.sampleService.BatchCreate(&req, userID)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, gin.H{"barcodes": barcodes, "count": len(barcodes)})
}

func (c *SampleController) UpdateStatus(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	var req dto.UpdateSampleStatusRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	userID := getCurrentUserID(ctx)
	if ec := c.sampleService.UpdateStatus(id, req.Status, req.Remark, userID); ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, nil)
}

func (c *SampleController) CancelSample(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	var req dto.CancelSampleRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	userID := getCurrentUserID(ctx)
	if ec := c.sampleService.Cancel(id, req.Reason, userID); ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, nil)
}

func (c *SampleController) GetSample(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	sample, ec := c.sampleService.GetByID(id)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, sample)
}

func (c *SampleController) GetSampleByBarcode(ctx *gin.Context) {
	barcode := ctx.Param("barcode")
	if barcode == "" {
		response.Fail(ctx, appErr.ErrInvalidParams.WithMessage("barcode不能为空"))
		return
	}
	sample, ec := c.sampleService.GetByBarcode(barcode)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, sample)
}

func (c *SampleController) ListSample(ctx *gin.Context) {
	var req dto.SampleQuery
	if !c.bindQueryAndValidate(ctx, &req) {
		return
	}
	currentInstID := getCurrentInstitutionID(ctx)
	list, total, ec := c.sampleService.List(&req, currentInstID)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.SuccessPage(ctx, list, total, req.Page, req.PageSize)
}

func (c *SampleController) GetStatusLogs(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	logs, ec := c.sampleService.GetStatusLogs(id)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, logs)
}

func (c *SampleController) SubmitTestResults(ctx *gin.Context) {
	var req dto.SubmitTestResultsRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	userID := getCurrentUserID(ctx)
	if ec := c.testResultService.SubmitResults(&req, userID); ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, nil)
}

func (c *SampleController) GetTestResults(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	results, ec := c.testResultService.GetResults(id)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, results)
}

func (c *SampleController) ReviewCriticalValue(ctx *gin.Context) {
	var req dto.ReviewCriticalValueRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	userID := getCurrentUserID(ctx)
	role, _ := ctx.Get("role")
	roleStr := ""
	if role != nil {
		roleStr = role.(string)
	}
	if ec := c.criticalValueService.Review(&req, userID, roleStr); ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, nil)
}

func (c *SampleController) GetCriticalValues(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	records, ec := c.criticalValueService.GetBySample(id)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, records)
}
