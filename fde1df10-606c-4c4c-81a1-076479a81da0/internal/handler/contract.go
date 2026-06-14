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
		"contract": contract,
		"approvals": approvals,
	}))
}

type ApproveContractRequest struct {
	Action  string `json:"action" binding:"required,oneof=approve reject return"`
	Comment string `json:"comment"`
}

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
