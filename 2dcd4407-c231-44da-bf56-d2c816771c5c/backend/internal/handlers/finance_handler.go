package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"exhibition-center/internal/middleware"
	"exhibition-center/internal/models"
	"exhibition-center/internal/repositories"
	"exhibition-center/internal/services"
)

type FinanceHandler struct {
	repo            *repositories.FinanceRepository
	financeSysSvc   *services.FinanceSystemService
}

func NewFinanceHandler() *FinanceHandler {
	return &FinanceHandler{
		repo:          repositories.NewFinanceRepository(models.DB),
		financeSysSvc: services.NewFinanceSystemService(),
	}
}

// ListRecords godoc
// @Summary 获取财务记录列表
// @Description 分页获取财务收支记录
// @Tags 财务结算
// @Produce json
// @Security BearerAuth
// @Param page query int false "页码" default(1)
// @Param pageSize query int false "每页数量" default(20)
// @Param type query string false "类型: income/expense/deposit/refund"
// @Param status query string false "状态"
// @Param keyword query string false "关键词搜索"
// @Param startDate query string false "开始日期"
// @Param endDate query string false "结束日期"
// @Success 200 {object} APIResponse
// @Router /api/finance/records [get]
func (h *FinanceHandler) ListRecords(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	records, total, err := h.repo.ListRecords(
		page, pageSize,
		c.QueryParam("type"),
		c.QueryParam("status"),
		c.QueryParam("keyword"),
		c.QueryParam("startDate"),
		c.QueryParam("endDate"),
	)
	if err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return PageDataResponse(c, records, total, page, pageSize)
}

// GetRecord godoc
// @Summary 获取财务记录详情
// @Description 根据ID获取财务记录详情
// @Tags 财务结算
// @Produce json
// @Security BearerAuth
// @Param id path string true "记录ID"
// @Success 200 {object} APIResponse{data=models.FinanceRecord}
// @Router /api/finance/records/{id} [get]
func (h *FinanceHandler) GetRecord(c echo.Context) error {
	id := c.Param("id")
	record, err := h.repo.GetRecordByID(id)
	if err != nil {
		return ErrorResponse(c, http.StatusNotFound, "记录不存在")
	}
	return SuccessResponse(c, record)
}

// CreateRecord godoc
// @Summary 创建财务记录
// @Description 创建新的财务记录
// @Tags 财务结算
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body models.FinanceRecord true "财务记录信息"
// @Success 200 {object} APIResponse{data=models.FinanceRecord}
// @Router /api/finance/records [post]
func (h *FinanceHandler) CreateRecord(c echo.Context) error {
	var record models.FinanceRecord
	if err := c.Bind(&record); err != nil {
		return ErrorResponse(c, http.StatusBadRequest, "请求参数错误")
	}

	user := middleware.GetCurrentUser(c)
	if user != nil {
		record.OperatorID = user.UserID
		record.OperatorName = user.Name
	}

	if record.Currency == "" {
		record.Currency = "CNY"
	}
	if record.Status == "" {
		record.Status = models.FinanceStatusPending
	}

	if err := h.repo.CreateRecord(&record); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return SuccessResponse(c, record)
}

// UpdateRecord godoc
// @Summary 更新财务记录
// @Description 更新财务记录信息
// @Tags 财务结算
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "记录ID"
// @Param request body map[string]interface{} true "更新字段"
// @Success 200 {object} APIResponse{data=models.FinanceRecord}
// @Router /api/finance/records/{id} [put]
func (h *FinanceHandler) UpdateRecord(c echo.Context) error {
	id := c.Param("id")

	var data map[string]interface{}
	if err := c.Bind(&data); err != nil {
		return ErrorResponse(c, http.StatusBadRequest, "请求参数错误")
	}

	if err := h.repo.UpdateRecord(id, data); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	record, _ := h.repo.GetRecordByID(id)
	return SuccessResponse(c, record)
}

// DeleteRecord godoc
// @Summary 删除财务记录
// @Description 删除财务记录
// @Tags 财务结算
// @Produce json
// @Security BearerAuth
// @Param id path string true "记录ID"
// @Success 200 {object} APIResponse
// @Router /api/finance/records/{id} [delete]
func (h *FinanceHandler) DeleteRecord(c echo.Context) error {
	id := c.Param("id")
	if err := h.repo.DeleteRecord(id); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}
	return SuccessResponse(c, nil)
}

// ConfirmRecord godoc
// @Summary 确认财务记录
// @Description 确认财务记录有效
// @Tags 财务结算
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "记录ID"
// @Success 200 {object} APIResponse{data=models.FinanceRecord}
// @Router /api/finance/records/{id}/confirm [post]
func (h *FinanceHandler) ConfirmRecord(c echo.Context) error {
	id := c.Param("id")
	user := middleware.GetCurrentUser(c)

	data := map[string]interface{}{
		"status":       models.FinanceStatusConfirmed,
		"confirmed_by": user.Name,
		"confirmed_at": time.Now().Format(time.RFC3339),
	}

	if err := h.repo.UpdateRecord(id, data); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	record, _ := h.repo.GetRecordByID(id)
	return SuccessResponse(c, record)
}

// GetSummary godoc
// @Summary 获取财务汇总
// @Description 获取收入、支出、押金、退款等汇总数据
// @Tags 财务结算
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse{data=models.FinanceSummary}
// @Router /api/finance/summary [get]
func (h *FinanceHandler) GetSummary(c echo.Context) error {
	summary, err := h.repo.GetSummary()
	if err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}
	return SuccessResponse(c, summary)
}

// ListDeposits godoc
// @Summary 获取押金列表
// @Description 获取押金记录列表
// @Tags 财务结算
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse{data=[]models.DepositRecord}
// @Router /api/finance/deposits [get]
func (h *FinanceHandler) ListDeposits(c echo.Context) error {
	deposits, err := h.repo.ListDeposits()
	if err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}
	return SuccessResponse(c, deposits)
}

// RefundDeposit godoc
// @Summary 退还押金
// @Description 退还部分或全部押金
// @Tags 财务结算
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "押金记录ID"
// @Success 200 {object} APIResponse{data=models.DepositRecord}
// @Router /api/finance/deposit/{id}/refund [post]
func (h *FinanceHandler) RefundDeposit(c echo.Context) error {
	id := c.Param("id")

	var req struct {
		RefundAmount float64 `json:"refundAmount"`
		Reason       string  `json:"reason"`
	}
	c.Bind(&req)

	deposit, err := h.repo.GetDepositByID(id)
	if err != nil {
		return ErrorResponse(c, http.StatusNotFound, "押金记录不存在")
	}

	newRefunded := deposit.RefundedAmount + req.RefundAmount
	status := models.DepositStatusPartial
	if newRefunded >= deposit.RefundableAmount {
		status = models.DepositStatusRefunded
	}

	data := map[string]interface{}{
		"refunded_amount": newRefunded,
		"refund_date":     time.Now().Format(time.RFC3339),
		"status":          status,
	}

	if err := h.repo.UpdateDeposit(id, data); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	deposit, _ = h.repo.GetDepositByID(id)
	return SuccessResponse(c, deposit)
}

// MergeSettle godoc
// @Summary 合并结算
// @Description 多展会合并结算
// @Tags 财务结算
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse{data=models.MergeSettleResult}
// @Router /api/finance/merge-settle [post]
func (h *FinanceHandler) MergeSettle(c echo.Context) error {
	var req struct {
		ScheduleIDs   []string `json:"scheduleIds"`
		IncludeDeposit bool     `json:"includeDeposit"`
	}
	c.Bind(&req)

	records, err := h.repo.GetByScheduleIDs(req.ScheduleIDs)
	if err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	var income, expense, deposit float64
	for _, r := range records {
		switch r.Type {
		case models.FinanceTypeIncome:
			income += r.Amount
		case models.FinanceTypeExpense:
			expense += r.Amount
		case models.FinanceTypeDeposit:
			if req.IncludeDeposit {
				deposit += r.Amount
			}
		}
	}

	result := models.MergeSettleResult{
		TotalAmount:   income - expense + deposit,
		IncomeAmount:  income,
		ExpenseAmount: expense,
		DepositAmount: deposit,
		Records:       records,
	}

	return SuccessResponse(c, result)
}

// ExportToFinanceSystem godoc
// @Summary 导出到财务系统
// @Description 将财务记录导出到外部财务系统
// @Tags 财务结算
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Router /api/finance/export-to-system [post]
func (h *FinanceHandler) ExportToFinanceSystem(c echo.Context) error {
	if !h.financeSysSvc.IsEnabled() {
		return ErrorResponse(c, http.StatusBadRequest, "财务系统对接未配置，请联系管理员")
	}

	var req struct {
		RecordIDs []string `json:"recordIds"`
	}
	c.Bind(&req)

	var records []models.FinanceRecord
	if len(req.RecordIDs) > 0 {
		for _, id := range req.RecordIDs {
			record, err := h.repo.GetRecordByID(id)
			if err == nil {
				records = append(records, *record)
			}
		}
	} else {
		recs, _, _ := h.repo.ListRecords(1, 100, "", string(models.FinanceStatusConfirmed), "", "", "")
		records = recs
	}

	if len(records) == 0 {
		return ErrorResponse(c, http.StatusBadRequest, "没有可导出的记录")
	}

	results, err := h.financeSysSvc.BatchExportVouchers(records)
	if err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return SuccessResponse(c, map[string]interface{}{
		"total":   len(records),
		"results": results,
	})
}

// ExportRecords godoc
// @Summary 导出财务记录
// @Description 导出财务记录为Excel/CSV格式
// @Tags 财务结算
// @Produce octet-stream
// @Security BearerAuth
// @Router /api/finance/records/export [get]
func (h *FinanceHandler) ExportRecords(c echo.Context) error {
	records, _, err := h.repo.ListRecords(1, 1000, "", "", "", "", "")
	if err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	c.Response().Header().Set("Content-Type", "text/csv; charset=utf-8")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=finance_records.csv")

	csvContent := "日期,类型,金额,状态,关联展会,合同号,对方单位,备注\n"
	for _, r := range records {
		csvContent += r.CreatedAt.Format("2006-01-02") + "," +
			string(r.Type) + "," +
			strconv.FormatFloat(r.Amount, 'f', 2, 64) + "," +
			string(r.Status) + "," +
			r.ScheduleName + "," +
			r.ContractNo + "," +
			r.PartyName + "," +
			r.Remark + "\n"
	}

	return c.Blob(http.StatusOK, "text/csv; charset=utf-8", []byte(csvContent))
}

// UploadFile godoc
// @Summary 上传文件
// @Description 上传发票或附件文件，限制50MB
// @Tags 文件上传
// @Accept multipart/form-data
// @Produce json
// @Security BearerAuth
// @Param file formData file true "文件"
// @Success 200 {object} APIResponse
// @Router /api/upload [post]
func UploadFile(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return ErrorResponse(c, http.StatusBadRequest, "获取文件失败")
	}

	if file.Size == 0 {
		return ErrorResponse(c, http.StatusBadRequest, "文件为空")
	}

	return SuccessResponse(c, map[string]interface{}{
		"filename": file.Filename,
		"size":     file.Size,
		"url":      "/uploads/" + file.Filename,
	})
}
