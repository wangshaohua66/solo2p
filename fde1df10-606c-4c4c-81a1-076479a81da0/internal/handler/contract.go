package handler

import (
	"errors"
	"net/http"
	"strconv"

	"venue-scheduler/internal/middleware"
	"venue-scheduler/internal/pkg/response"
	"venue-scheduler/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ContractHandler struct {
	db *gorm.DB
}

func NewContractHandler(db *gorm.DB) *ContractHandler {
	return &ContractHandler{db: db}
}

type CreateContractRequest struct {
	BookingID uint   `json:"booking_id" binding:"required"`
	Title     string `json:"title" binding:"required"`
	Content   string `json:"content"`
}

// CreateContract godoc
// @Summary 提交合同
// @Description 制作人提交合同申请，合同初始状态为 pending_tech（待技术总监审批）
// @Tags contracts
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body CreateContractRequest true "合同参数（booking_id/title必填）"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/contracts [post]
func (h *ContractHandler) CreateContract(c *gin.Context) {
	userID, exists := c.Get(middleware.ContextUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}
	uid, ok := userID.(uint)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid user id"))
		return
	}

	var req CreateContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	var booking repository.Booking
	if err := h.db.First(&booking, req.BookingID).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "booking not found"))
		return
	}

	var existingContract repository.Contract
	result := h.db.Where("booking_id = ?", req.BookingID).First(&existingContract)
	if result.Error == nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "contract already exists for this booking"))
		return
	}
	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to check existing contract"))
		return
	}

	contract := repository.Contract{
		BookingID:   req.BookingID,
		SubmitterID: uid,
		Title:       req.Title,
		Content:     req.Content,
		Status:      repository.ContractStatusPendingTech,
		CurrentStep: 1,
	}

	if err := h.db.Create(&contract).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create contract"))
		return
	}

	if err := h.db.Preload("Booking").Preload("Submitter").First(&contract, contract.ID).Error; err == nil {
		c.JSON(http.StatusCreated, response.Success(contract))
		return
	}

	c.JSON(http.StatusCreated, response.Success(contract))
}

// GetContracts godoc
// @Summary 获取合同列表
// @Description 根据当前用户角色过滤可见合同列表：tech_director看pending_tech，finance看pending_finance，venue_manager看pending_venue，producer看自己提交的；支持status筛选
// @Tags contracts
// @Accept json
// @Produce json
// @Security Bearer
// @Param status query string false "合同状态(pending_tech/pending_finance/pending_venue/approved/rejected/returned)"
// @Success 200 {array} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/contracts [get]
func (h *ContractHandler) GetContracts(c *gin.Context) {
	userID, exists := c.Get(middleware.ContextUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}
	uid, ok := userID.(uint)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid user id"))
		return
	}

	userRole, exists := c.Get(middleware.ContextUserRole)
	if !exists {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user role not found"))
		return
	}
	role, ok := userRole.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid user role"))
		return
	}

	query := h.db.Model(&repository.Contract{}).Preload("Booking").Preload("Submitter")

	switch role {
	case string(repository.UserRoleTechDirector):
		query = query.Where("status = ?", repository.ContractStatusPendingTech)
	case string(repository.UserRoleFinance):
		query = query.Where("status = ?", repository.ContractStatusPendingFinance)
	case string(repository.UserRoleVenueManager):
		query = query.Where("status = ?", repository.ContractStatusPendingVenue)
	case string(repository.UserRoleProducer):
		query = query.Where("submitter_id = ?", uid)
	}

	statusStr := c.Query("status")
	if statusStr != "" {
		query = query.Where("status = ?", statusStr)
	}

	var contracts []repository.Contract
	if err := query.Order("created_at DESC").Find(&contracts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query contracts"))
		return
	}

	c.JSON(http.StatusOK, response.Success(contracts))
}

// GetContract godoc
// @Summary 获取合同详情
// @Description 根据合同ID获取合同详情，包含关联档期、提交人信息及完整审批历史
// @Tags contracts
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "合同ID"
// @Success 200 {object} map[string]interface{} "返回contract合同详情和approvals审批历史"
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/contracts/{id} [get]
func (h *ContractHandler) GetContract(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid contract id"))
		return
	}

	var contract repository.Contract
	if err := h.db.Preload("Booking").Preload("Booking.Venue").Preload("Booking.User").Preload("Submitter").
		First(&contract, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "contract not found"))
		return
	}

	var approvals []repository.ContractApproval
	if err := h.db.Where("contract_id = ?", contract.ID).Preload("Approver").
		Order("created_at ASC").Find(&approvals).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query approvals"))
		return
	}

	c.JSON(http.StatusOK, response.Success(gin.H{
		"contract":  contract,
		"approvals": approvals,
	}))
}

type ApproveContractRequest struct {
	Action  string `json:"action" binding:"required,oneof=approve reject return"`
	Comment string `json:"comment"`
}

// ApproveContract godoc
// @Summary 审批合同
// @Description 三步审批流转：第一步tech_director审批pending_tech，第二步finance审批pending_finance，第三步venue_manager审批pending_venue；操作包括approve（通过进入下一步）、reject（拒绝终止）、return（退回修改）
// @Tags contracts
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "合同ID"
// @Param request body ApproveContractRequest true "审批参数"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 403 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/contracts/{id}/approve [put]
func (h *ContractHandler) ApproveContract(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid contract id"))
		return
	}

	userID, exists := c.Get(middleware.ContextUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}
	uid, ok := userID.(uint)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid user id"))
		return
	}

	userRole, exists := c.Get(middleware.ContextUserRole)
	if !exists {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user role not found"))
		return
	}
	role, ok := userRole.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid user role"))
		return
	}

	var req ApproveContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	var contract repository.Contract
	if err := h.db.First(&contract, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "contract not found"))
		return
	}

	if contract.Status == repository.ContractStatusApproved ||
		contract.Status == repository.ContractStatusRejected {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "contract has been finalized, cannot be processed"))
		return
	}

	var canApprove bool
	step := contract.CurrentStep
	switch role {
	case string(repository.UserRoleTechDirector):
		canApprove = contract.Status == repository.ContractStatusPendingTech && step == 1
	case string(repository.UserRoleFinance):
		canApprove = contract.Status == repository.ContractStatusPendingFinance && step == 2
	case string(repository.UserRoleVenueManager):
		canApprove = contract.Status == repository.ContractStatusPendingVenue && step == 3
	}

	if !canApprove {
		c.JSON(http.StatusForbidden, response.Fail(http.StatusForbidden, "you don't have permission to approve this contract at current step"))
		return
	}

	tx := h.db.Begin()

	approval := repository.ContractApproval{
		ContractID: contract.ID,
		ApproverID: uid,
		Step:       step,
		Action:     repository.ContractApprovalAction(req.Action),
		Comment:    req.Comment,
	}
	if err := tx.Create(&approval).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create approval record"))
		return
	}

	var newStatus repository.ContractStatus
	var newStep int

	switch req.Action {
	case "approve":
		switch step {
		case 1:
			newStatus = repository.ContractStatusPendingFinance
			newStep = 2
		case 2:
			newStatus = repository.ContractStatusPendingVenue
			newStep = 3
		case 3:
			newStatus = repository.ContractStatusApproved
			newStep = 4
		}
	case "reject":
		newStatus = repository.ContractStatusRejected
		newStep = step
	case "return":
		newStatus = repository.ContractStatusReturned
		newStep = 0
	}

	if err := tx.Model(&contract).Updates(map[string]interface{}{
		"status":       newStatus,
		"current_step": newStep,
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to update contract status"))
		return
	}

	tx.Commit()

	if err := h.db.Preload("Booking").Preload("Submitter").First(&contract, contract.ID).Error; err == nil {
		c.JSON(http.StatusOK, response.Success(contract))
		return
	}

	c.JSON(http.StatusOK, response.Success(gin.H{
		"id":           contract.ID,
		"status":       newStatus,
		"current_step": newStep,
	}))
}

type UpdateContractRequest struct {
	Title   *string `json:"title"`
	Content *string `json:"content"`
}

// UpdateContract godoc
// @Summary 修改退回的合同
// @Description 制作人修改被退回的合同（状态为 returned），修改后重新进入 pending_tech 审批流程
// @Tags contracts
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "合同ID"
// @Param request body UpdateContractRequest true "合同更新参数"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 403 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/contracts/{id} [put]
func (h *ContractHandler) UpdateContract(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid contract id"))
		return
	}

	userID, exists := c.Get(middleware.ContextUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}
	uid, ok := userID.(uint)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid user id"))
		return
	}

	var contract repository.Contract
	if err := h.db.First(&contract, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "contract not found"))
		return
	}

	if contract.SubmitterID != uid {
		c.JSON(http.StatusForbidden, response.Fail(http.StatusForbidden, "you don't have permission to update this contract"))
		return
	}

	if contract.Status != repository.ContractStatusReturned {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "only returned contracts can be updated"))
		return
	}

	var req UpdateContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	if req.Title != nil {
		contract.Title = *req.Title
	}
	if req.Content != nil {
		contract.Content = *req.Content
	}

	contract.Status = repository.ContractStatusPendingTech
	contract.CurrentStep = 1

	if err := h.db.Save(&contract).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to update contract"))
		return
	}

	if err := h.db.Preload("Booking").Preload("Submitter").First(&contract, contract.ID).Error; err == nil {
		c.JSON(http.StatusOK, response.Success(contract))
		return
	}

	c.JSON(http.StatusOK, response.Success(contract))
}
