package handler

import (
	"craftbrew-tracker/internal/dto"
	"craftbrew-tracker/internal/middleware"
	"craftbrew-tracker/internal/model"
	"craftbrew-tracker/internal/service"
	"craftbrew-tracker/internal/util"
	"craftbrew-tracker/internal/repository"

	"github.com/labstack/echo/v4"
)

// ---------- Trace ----------
// GetTraceChain godoc
// @Summary 获取批次全链路追溯信息
// @Tags 追溯管理
// @Param Authorization header string true "Bearer token"
// @Param id path int true "批次ID"
// @Success 200 {object} util.Response{data=dto.TraceChainResponse}
// @Router /api/v1/trace/{id} [get]
func (h *Handler) GetTraceChain(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	if id == 0 {
		return util.FailBadRequest(c, "无效的批次ID")
	}
	chain, err := h.svc.GetTraceChain(id)
	if err != nil {
		switch err {
		case service.ErrBatchNotFound:
			return util.FailNotFound(c, "批次不存在")
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, chain)
}

// TraceQuery godoc
// @Summary 多维度查询批次追溯记录
// @Tags 追溯管理
// @Param Authorization header string true "Bearer token"
// @Param batchNo query string false "批次号模糊查询"
// @Param startDate query string false "开始时间 RFC3339"
// @Param endDate query string false "结束时间 RFC3339"
// @Param stage query string false "阶段"
// @Param qualityStatus query string false "质检状态"
// @Param page query int false "页码"
// @Param pageSize query int false "每页"
// @Success 200 {object} util.Response{data=util.PageResult}
// @Router /api/v1/trace [get]
func (h *Handler) TraceQuery(c echo.Context) error {
	q := &dto.TraceQueryRequest{
		BatchNo:       c.QueryParam("batchNo"),
		StartDate:     parseTimePtr(c.QueryParam("startDate")),
		EndDate:       parseTimePtr(c.QueryParam("endDate")),
		Stage:         model.BatchStage(c.QueryParam("stage")),
		QualityStatus: model.QualityStatus(c.QueryParam("qualityStatus")),
		Page:          parseInt(c.QueryParam("page"), 1),
		PageSize:      parseInt(c.QueryParam("pageSize"), 20),
	}
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PageSize <= 0 {
		q.PageSize = 20
	}
	list, total, err := h.svc.Traces.TraceQuery(q)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Page(c, list, total, q.Page, q.PageSize)
}

// ---------- Compliance Report ----------
// ExportReport godoc
// @Summary 导出台账/合规报告（异步，返回taskId）
// @Tags 合规报告
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param request body dto.ExportReportRequest true "导出参数"
// @Success 200 {object} util.Response{data=map[string]string}
// @Router /api/v1/reports/export [post]
func (h *Handler) ExportReport(c echo.Context) error {
	user := middleware.GetAuth(c)
	req := &dto.ExportReportRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	taskID, _, err := h.svc.ExportReport(req.BatchID, user.UserID)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, map[string]string{
		"taskId": taskID,
		"message": "report generation started, poll /api/v1/tasks/{taskId} for status",
	})
}

// ListReports godoc
// @Summary 查询合规报告列表
// @Tags 合规报告
// @Param Authorization header string true "Bearer token"
// @Param batchId query int false "批次ID"
// @Success 200 {object} util.Response{data=util.PageResult}
// @Router /api/v1/reports [get]
func (h *Handler) ListReports(c echo.Context) error {
	batchID := parseInt64(c.QueryParam("batchId"), 0)
	p := dto.PaginationParams{}
	_ = c.Bind(&p)
	page, size := p.Normalize()
	list, total, err := h.svc.Reports.List(batchID, page, size)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Page(c, list, total, page, size)
}

// GetReport godoc
// @Summary 查询合规报告详情（含JSON内容）
// @Tags 合规报告
// @Param Authorization header string true "Bearer token"
// @Param id path int true "报告ID"
// @Success 200 {object} util.Response
// @Router /api/v1/reports/{id} [get]
func (h *Handler) GetReport(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	rp, err := h.svc.Reports.Get(id)
	if err != nil {
		if repository.IsNoRows(err) {
			return util.FailNotFound(c, "报告不存在")
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, map[string]interface{}{
		"id":          rp.ID,
		"reportNo":    rp.ReportNo,
		"reportType":  rp.ReportType,
		"batchId":     rp.BatchID,
		"batchNo":     rp.BatchNo,
		"fileUrl":     rp.FileURL,
		"generatedBy": rp.GeneratedBy,
		"generatedAt": rp.GeneratedAt,
		"content":     rp.ContentJSON,
	})
}
