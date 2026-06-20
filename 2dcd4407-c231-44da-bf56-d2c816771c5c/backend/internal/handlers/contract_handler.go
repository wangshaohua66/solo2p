package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"exhibition-center/internal/middleware"
	"exhibition-center/internal/models"
	"exhibition-center/internal/repositories"
)

type ContractHandler struct {
	repo *repositories.ContractRepository
}

func NewContractHandler() *ContractHandler {
	return &ContractHandler{
		repo: repositories.NewContractRepository(models.DB),
	}
}

// ListContracts godoc
// @Summary 获取合同列表
// @Description 分页获取合同列表
// @Tags 合同管理
// @Produce json
// @Security BearerAuth
// @Param page query int false "页码" default(1)
// @Param pageSize query int false "每页数量" default(20)
// @Param status query string false "状态筛选"
// @Param keyword query string false "关键词搜索"
// @Success 200 {object} APIResponse
// @Router /api/contracts [get]
func (h *ContractHandler) List(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	status := c.QueryParam("status")
	keyword := c.QueryParam("keyword")

	contracts, total, err := h.repo.List(page, pageSize, status, keyword)
	if err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return PageDataResponse(c, contracts, total, page, pageSize)
}

// GetContract godoc
// @Summary 获取合同详情
// @Description 根据ID获取合同详情
// @Tags 合同管理
// @Produce json
// @Security BearerAuth
// @Param id path string true "合同ID"
// @Success 200 {object} APIResponse{data=models.Contract}
// @Router /api/contracts/{id} [get]
func (h *ContractHandler) Get(c echo.Context) error {
	id := c.Param("id")
	contract, err := h.repo.GetByID(id)
	if err != nil {
		return ErrorResponse(c, http.StatusNotFound, "合同不存在")
	}
	return SuccessResponse(c, contract)
}

// CreateContract godoc
// @Summary 创建合同
// @Description 创建新合同
// @Tags 合同管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body models.Contract true "合同信息"
// @Success 200 {object} APIResponse{data=models.Contract}
// @Router /api/contracts [post]
func (h *ContractHandler) Create(c echo.Context) error {
	var contract models.Contract
	if err := c.Bind(&contract); err != nil {
		return ErrorResponse(c, http.StatusBadRequest, "请求参数错误")
	}

	if contract.Status == "" {
		contract.Status = models.ContractStatusDraft
	}

	if err := h.repo.Create(&contract); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return SuccessResponse(c, contract)
}

// UpdateContract godoc
// @Summary 更新合同
// @Description 更新合同信息
// @Tags 合同管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "合同ID"
// @Param request body map[string]interface{} true "更新字段"
// @Success 200 {object} APIResponse{data=models.Contract}
// @Router /api/contracts/{id} [put]
func (h *ContractHandler) Update(c echo.Context) error {
	id := c.Param("id")

	var data map[string]interface{}
	if err := c.Bind(&data); err != nil {
		return ErrorResponse(c, http.StatusBadRequest, "请求参数错误")
	}

	data["updated_at"] = time.Now()

	if err := h.repo.Update(id, data); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	contract, _ := h.repo.GetByID(id)
	return SuccessResponse(c, contract)
}

// DeleteContract godoc
// @Summary 删除合同
// @Description 删除合同
// @Tags 合同管理
// @Produce json
// @Security BearerAuth
// @Param id path string true "合同ID"
// @Success 200 {object} APIResponse
// @Router /api/contracts/{id} [delete]
func (h *ContractHandler) Delete(c echo.Context) error {
	id := c.Param("id")
	if err := h.repo.Delete(id); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}
	return SuccessResponse(c, nil)
}

// SubmitApproval godoc
// @Summary 提交审批
// @Description 提交合同审批
// @Tags 合同管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "合同ID"
// @Success 200 {object} APIResponse{data=models.Contract}
// @Router /api/contracts/{id}/submit-approval [post]
func (h *ContractHandler) SubmitApproval(c echo.Context) error {
	id := c.Param("id")

	data := map[string]interface{}{
		"status":       models.ContractStatusReviewing,
		"current_step": 1,
		"updated_at":   time.Now(),
	}

	if err := h.repo.Update(id, data); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	contract, _ := h.repo.GetByID(id)
	return SuccessResponse(c, contract)
}

// ApproveContract godoc
// @Summary 审批通过合同
// @Description 审批通过合同
// @Tags 合同管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "合同ID"
// @Success 200 {object} APIResponse{data=models.Contract}
// @Router /api/contracts/{id}/approve [post]
func (h *ContractHandler) Approve(c echo.Context) error {
	id := c.Param("id")
	user := middleware.GetCurrentUser(c)

	contract, err := h.repo.GetByID(id)
	if err != nil {
		return ErrorResponse(c, http.StatusNotFound, "合同不存在")
	}

	newFlow := contract.ApprovalFlow
	for i := range newFlow {
		newFlow[i].Status = "approved"
		newFlow[i].Approver = user.Name
		newFlow[i].ApprovedAt = time.Now().Format(time.RFC3339)
	}

	data := map[string]interface{}{
		"status":        models.ContractStatusApproved,
		"current_step":  len(newFlow),
		"approval_flow": newFlow,
		"updated_at":    time.Now(),
	}

	if err := h.repo.Update(id, data); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	contract, _ = h.repo.GetByID(id)
	return SuccessResponse(c, contract)
}

// RejectContract godoc
// @Summary 驳回合同
// @Description 驳回合同审批
// @Tags 合同管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "合同ID"
// @Success 200 {object} APIResponse{data=models.Contract}
// @Router /api/contracts/{id}/reject [post]
func (h *ContractHandler) Reject(c echo.Context) error {
	id := c.Param("id")
	user := middleware.GetCurrentUser(c)

	var req struct {
		Comment string `json:"comment"`
	}
	c.Bind(&req)

	contract, err := h.repo.GetByID(id)
	if err != nil {
		return ErrorResponse(c, http.StatusNotFound, "合同不存在")
	}

	newFlow := contract.ApprovalFlow
	if len(newFlow) > contract.CurrentStep {
		newFlow[contract.CurrentStep].Status = "rejected"
		newFlow[contract.CurrentStep].Approver = user.Name
		newFlow[contract.CurrentStep].Comment = req.Comment
		newFlow[contract.CurrentStep].ApprovedAt = time.Now().Format(time.RFC3339)
	}

	data := map[string]interface{}{
		"status":        models.ContractStatusRejected,
		"approval_flow": newFlow,
		"updated_at":    time.Now(),
	}

	if err := h.repo.Update(id, data); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	contract, _ = h.repo.GetByID(id)
	return SuccessResponse(c, contract)
}

// SignContract godoc
// @Summary 合同签署
// @Description 电子签署合同
// @Tags 合同管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "合同ID"
// @Success 200 {object} APIResponse{data=models.Contract}
// @Router /api/contracts/{id}/sign [post]
func (h *ContractHandler) Sign(c echo.Context) error {
	id := c.Param("id")

	var req struct {
		SignatureURL string `json:"signatureUrl"`
	}
	c.Bind(&req)

	data := map[string]interface{}{
		"status":      models.ContractStatusSigned,
		"signed_url":  req.SignatureURL,
		"signed_at":   time.Now().Format(time.RFC3339),
		"archive_no":  "AR-" + strconv.FormatInt(time.Now().Unix(), 10),
		"updated_at":  time.Now(),
	}

	if err := h.repo.Update(id, data); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	contract, _ := h.repo.GetByID(id)
	return SuccessResponse(c, contract)
}

// ArchiveContract godoc
// @Summary 合同归档
// @Description 归档合同
// @Tags 合同管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "合同ID"
// @Success 200 {object} APIResponse{data=models.Contract}
// @Router /api/contracts/{id}/archive [post]
func (h *ContractHandler) Archive(c echo.Context) error {
	id := c.Param("id")

	data := map[string]interface{}{
		"status":     models.ContractStatusArchived,
		"updated_at": time.Now(),
	}

	if err := h.repo.Update(id, data); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	contract, _ := h.repo.GetByID(id)
	return SuccessResponse(c, contract)
}

// ListTemplates godoc
// @Summary 获取合同模板列表
// @Description 获取所有可用的合同模板
// @Tags 合同管理
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse{data=[]models.ContractTemplate}
// @Router /api/contracts/templates [get]
func (h *ContractHandler) ListTemplates(c echo.Context) error {
	templates, err := h.repo.ListTemplates()
	if err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}
	return SuccessResponse(c, templates)
}
