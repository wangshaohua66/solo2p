package controller

import (
	"equipment-trading-platform/internal/model"
	"equipment-trading-platform/internal/repository"
	"equipment-trading-platform/internal/service"
	"equipment-trading-platform/internal/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type DisputeController struct {
	disputeService *service.DisputeService
}

func NewDisputeController() *DisputeController {
	return &DisputeController{
		disputeService: service.NewDisputeService(),
	}
}

func (ctrl *DisputeController) FileDispute(c *gin.Context) {
	var req service.FileDisputeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	req.ApplicantID = util.GetUserID(c)

	dispute, err := ctrl.disputeService.FileDispute(&req)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, dispute)
}

func (ctrl *DisputeController) AddEvidence(c *gin.Context) {
	var req service.AddEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	req.UploaderID = util.GetUserID(c)

	if err := ctrl.disputeService.AddEvidence(&req); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}

func (ctrl *DisputeController) AssignArbitrator(c *gin.Context) {
	disputeID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的纠纷ID")
		return
	}

	var req struct {
		ArbitratorID uint64 `json:"arbitrator_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	if err := ctrl.disputeService.AssignArbitrator(disputeID, req.ArbitratorID); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}

func (ctrl *DisputeController) Resolve(c *gin.Context) {
	var req service.ResolveDisputeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	req.ArbitratorID = util.GetUserID(c)

	if err := ctrl.disputeService.Resolve(&req); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}

func (ctrl *DisputeController) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的纠纷ID")
		return
	}

	dispute, err := ctrl.disputeService.GetByID(id)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, dispute)
}

func (ctrl *DisputeController) List(c *gin.Context) {
	q := &repository.DisputeQuery{}

	if v := c.Query("applicant_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			q.ApplicantID = &id
		}
	}
	if v := c.Query("respondent_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			q.RespondentID = &id
		}
	}
	if v := c.Query("arbitrator_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			q.ArbitratorID = &id
		}
	}
	q.Status = c.Query("status")

	role := ""
	roles := util.GetRoles(c)
	if len(roles) > 0 {
		role = roles[0]
	}

	userID := util.GetUserID(c)
	if role == model.RoleArbitrator {
		q.ArbitratorID = &userID
	}

	q.Page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	q.PageSize, _ = strconv.Atoi(c.DefaultQuery("page_size", "20"))

	disputes, total, err := ctrl.disputeService.List(q)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.SuccessWithPage(c, disputes, total, q.Page, q.PageSize)
}

func (ctrl *DisputeController) ListEvidence(c *gin.Context) {
	disputeID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的纠纷ID")
		return
	}

	evidence, err := ctrl.disputeService.ListEvidence(disputeID)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, evidence)
}
