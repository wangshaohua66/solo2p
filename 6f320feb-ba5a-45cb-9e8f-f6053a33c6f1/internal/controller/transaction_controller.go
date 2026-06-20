package controller

import (
	"equipment-trading-platform/internal/model"
	"equipment-trading-platform/internal/repository"
	"equipment-trading-platform/internal/service"
	"equipment-trading-platform/internal/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type TransactionController struct {
	txService *service.TransactionService
}

func NewTransactionController() *TransactionController {
	return &TransactionController{
		txService: service.NewTransactionService(),
	}
}

func (ctrl *TransactionController) Create(c *gin.Context) {
	var req service.CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	req.BuyerID = util.GetUserID(c)

	tx, err := ctrl.txService.Create(&req)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, tx)
}

func (ctrl *TransactionController) Negotiate(c *gin.Context) {
	var req service.NegotiateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	req.UserID = util.GetUserID(c)

	tx, err := ctrl.txService.GetByID(req.TxID)
	if err != nil {
		util.Fail(c, err)
		return
	}
	req.IsSeller = (tx.SellerID == req.UserID)

	result, err := ctrl.txService.Negotiate(&req)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, result)
}

func (ctrl *TransactionController) FreezeFund(c *gin.Context) {
	var req service.FreezeFundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	req.PayerID = util.GetUserID(c)

	fund, err := ctrl.txService.FreezeFund(&req)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, fund)
}

func (ctrl *TransactionController) ConfirmTransfer(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的交易ID")
		return
	}

	operatorID := util.GetUserID(c)

	if err := ctrl.txService.ConfirmTransfer(id, operatorID); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}

func (ctrl *TransactionController) Complete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的交易ID")
		return
	}

	if err := ctrl.txService.Complete(id); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}

func (ctrl *TransactionController) Cancel(c *gin.Context) {
	var req service.CancelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	req.UserID = util.GetUserID(c)

	tx, err := ctrl.txService.GetByID(req.TxID)
	if err != nil {
		util.Fail(c, err)
		return
	}
	req.IsBuyer = (tx.BuyerID == req.UserID)

	if err := ctrl.txService.Cancel(&req); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}

func (ctrl *TransactionController) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的交易ID")
		return
	}

	tx, err := ctrl.txService.GetByID(id)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, tx)
}

func (ctrl *TransactionController) List(c *gin.Context) {
	q := &repository.TxQuery{}

	if v := c.Query("buyer_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			q.BuyerID = &id
		}
	}
	if v := c.Query("seller_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			q.SellerID = &id
		}
	}
	if v := c.Query("device_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			q.DeviceID = &id
		}
	}
	q.Status = c.Query("status")

	role := ""
	roles := util.GetRoles(c)
	if len(roles) > 0 {
		role = roles[0]
	}

	userID := util.GetUserID(c)
	if role == model.RoleBuyer {
		q.BuyerID = &userID
	} else if role == model.RoleSeller {
		q.SellerID = &userID
	}

	q.Page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	q.PageSize, _ = strconv.Atoi(c.DefaultQuery("page_size", "20"))

	txs, total, err := ctrl.txService.List(q)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.SuccessWithPage(c, txs, total, q.Page, q.PageSize)
}

func (ctrl *TransactionController) ListFunds(c *gin.Context) {
	txID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的交易ID")
		return
	}

	funds, err := ctrl.txService.ListFunds(txID)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, funds)
}
