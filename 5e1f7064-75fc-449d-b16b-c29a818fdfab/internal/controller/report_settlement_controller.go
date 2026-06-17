package controller

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"lab-management/internal/dto"
	appErr "lab-management/internal/pkg/errors"
	"lab-management/internal/pkg/response"
	"lab-management/internal/service"
)

type ReportController struct {
	*BaseController
	reportService  *service.ReportService
}

func NewReportController(
	base *BaseController,
	reportService *service.ReportService,
) *ReportController {
	return &ReportController{
		BaseController: base,
		reportService:  reportService,
	}
}

func (c *ReportController) GenerateReport(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	userID := getCurrentUserID(ctx)
	reportNo, ec := c.reportService.Generate(id, userID)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, gin.H{"report_no": reportNo})
}

func (c *ReportController) PublishReport(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	userID := getCurrentUserID(ctx)
	if ec := c.reportService.Publish(id, userID); ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, nil)
}

func (c *ReportController) GetReport(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	report, ec := c.reportService.GetByID(id)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	report.FileData = nil
	response.Success(ctx, report)
}

func (c *ReportController) GetReportByReportNo(ctx *gin.Context) {
	reportNo := ctx.Param("reportNo")
	if reportNo == "" {
		response.FailWithDetail(ctx, appErr.ErrInvalidParams, "reportNo不能为空")
		return
	}
	report, ec := c.reportService.GetByReportNo(reportNo)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	report.FileData = nil
	response.Success(ctx, report)
}

func (c *ReportController) GetReportBySample(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	report, ec := c.reportService.GetBySample(id)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	report.FileData = nil
	response.Success(ctx, report)
}

func (c *ReportController) DownloadReport(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	data, ec := c.reportService.GetFileData(id)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}

	report, _ := c.reportService.GetByID(id)
	filename := fmt.Sprintf("report_%s.pdf", report.ReportNo)

	ctx.Header("Content-Type", "application/pdf")
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	ctx.Header("Content-Length", fmt.Sprintf("%d", len(data)))
	ctx.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	ctx.Data(200, "application/pdf", data)
}

func (c *ReportController) PreviewReport(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	data, ec := c.reportService.GetFileData(id)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}

	report, _ := c.reportService.GetByID(id)
	filename := fmt.Sprintf("report_%s.pdf", report.ReportNo)

	userID := getCurrentUserID(ctx)
	instID := getCurrentInstitutionID(ctx)
	username, _ := ctx.Get("username")
	uname := ""
	if username != nil {
		uname = username.(string)
	}
	ip := ctx.ClientIP()
	_ = c.reportService.MarkRead(id, userID, uname, instID, ip)

	ctx.Header("Content-Type", "application/pdf")
	ctx.Header("Content-Disposition", fmt.Sprintf("inline; filename=%s", filename))
	ctx.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	ctx.Data(200, "application/pdf", data)
}

func (c *ReportController) ListReport(ctx *gin.Context) {
	var req dto.SampleReportQuery
	if !c.bindQueryAndValidate(ctx, &req) {
		return
	}
	currentInstID := getCurrentInstitutionID(ctx)
	list, total, ec := c.reportService.List(&req, currentInstID)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	for i := range list {
		list[i].FileData = nil
	}
	response.SuccessPage(ctx, list, total, req.Page, req.PageSize)
}

func (c *ReportController) MarkReportRead(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	userID := getCurrentUserID(ctx)
	instID := getCurrentInstitutionID(ctx)
	username, _ := ctx.Get("username")
	uname := ""
	if username != nil {
		uname = username.(string)
	}
	ip := ctx.ClientIP()
	if ec := c.reportService.MarkRead(id, userID, uname, instID, ip); ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, nil)
}

type SettlementController struct {
	*BaseController
	settlementService *service.SettlementService
}

func NewSettlementController(
	base *BaseController,
	settlementService *service.SettlementService,
) *SettlementController {
	return &SettlementController{
		BaseController:    base,
		settlementService: settlementService,
	}
}

func (c *SettlementController) CreateSettlement(ctx *gin.Context) {
	var req dto.CreateSettlementRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	id, ec := c.settlementService.Create(&req)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, gin.H{"id": id})
}

func (c *SettlementController) ConfirmSettlement(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	var req dto.ConfirmSettlementRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	userID := getCurrentUserID(ctx)
	if ec := c.settlementService.Confirm(id, &req, userID); ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, nil)
}

func (c *SettlementController) GetSettlement(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	settlement, ec := c.settlementService.GetByID(id)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, settlement)
}

func (c *SettlementController) GetSettlementByMonth(ctx *gin.Context) {
	instID, ok := getUintID(ctx, "institutionId")
	if !ok {
		return
	}
	yearStr := ctx.Query("year")
	monthStr := ctx.Query("month")
	year := 0
	month := 0
	fmt.Sscanf(yearStr, "%d", &year)
	fmt.Sscanf(monthStr, "%d", &month)
	if year < 2000 || month < 1 || month > 12 {
		response.Fail(ctx, appErr.ErrInvalidParams)
		return
	}
	settlement, ec := c.settlementService.GetByMonth(instID, year, month)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, settlement)
}

func (c *SettlementController) ListSettlement(ctx *gin.Context) {
	var req dto.SettlementQuery
	if !c.bindQueryAndValidate(ctx, &req) {
		return
	}
	currentInstID := getCurrentInstitutionID(ctx)
	list, total, ec := c.settlementService.List(&req, currentInstID)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.SuccessPage(ctx, list, total, req.Page, req.PageSize)
}

func (c *SettlementController) GetSettlementDetails(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	details, ec := c.settlementService.GetDetails(id)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, details)
}

type StatisticsController struct {
	*BaseController
	statsService *service.StatisticsService
}

func NewStatisticsController(
	base *BaseController,
	statsService *service.StatisticsService,
) *StatisticsController {
	return &StatisticsController{
		BaseController: base,
		statsService:   statsService,
	}
}

func (c *StatisticsController) QueryStats(ctx *gin.Context) {
	var req dto.StatisticsQuery
	if !c.bindQueryAndValidate(ctx, &req) {
		return
	}
	currentInstID := getCurrentInstitutionID(ctx)
	result, ec := c.statsService.Query(&req, currentInstID)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, result)
}

func (c *StatisticsController) DashboardSummary(ctx *gin.Context) {
	end := time.Now()
	start := end.AddDate(0, 0, -30)
	currentInstID := getCurrentInstitutionID(ctx)

	urgency, ec := c.statsService.Query(&dto.StatisticsQuery{
		StartTime:     start,
		EndTime:       end,
		InstitutionID: nil,
		Dimension:     "urgency",
	}, currentInstID)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}

	category, ec := c.statsService.Query(&dto.StatisticsQuery{
		StartTime:     start,
		EndTime:       end,
		InstitutionID: nil,
		Dimension:     "category",
	}, currentInstID)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}

	status, ec := c.statsService.Query(&dto.StatisticsQuery{
		StartTime:     start,
		EndTime:       end,
		InstitutionID: nil,
		Dimension:     "status",
	}, currentInstID)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}

	response.Success(ctx, gin.H{
		"period":   gin.H{"start": start.Format("2006-01-02"), "end": end.Format("2006-01-02")},
		"urgency":  urgency.Data,
		"category": category.Data,
		"status":   status.Data,
	})
}
