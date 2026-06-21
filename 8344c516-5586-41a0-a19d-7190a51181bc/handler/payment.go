package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"exam-system/model"

	"github.com/gin-gonic/gin"
)

type CreatePaymentRequest struct {
	ApplyID    uint   `json:"applyId" binding:"required"`
	PayChannel string `json:"payChannel" binding:"required,oneof=wechat alipay bank"`
	ReturnUrl  string `json:"returnUrl"`
}

type PaymentVO struct {
	ID           uint       `json:"id"`
	OrderNo      string     `json:"orderNo"`
	ApplyID      uint       `json:"applyId"`
	ExamID       uint       `json:"examId"`
	ExamName     string     `json:"examName"`
	Amount       float64    `json:"amount"`
	PayChannel   string     `json:"payChannel"`
	PayStatus    int        `json:"payStatus"`
	PayStatusText string   `json:"payStatusText"`
	ThirdPartyNo string     `json:"thirdPartyNo,omitempty"`
	PayTime      *time.Time `json:"payTime,omitempty"`
	ExpireTime   time.Time  `json:"expireTime"`
	CreatedAt    time.Time  `json:"createdAt"`
	PayUrl       string     `json:"payUrl,omitempty"`
	QrCode       string     `json:"qrCode,omitempty"`
}

func getPayStatusText(status int) string {
	switch status {
	case 0:
		return "待支付"
	case 1:
		return "已支付"
	case 2:
		return "已退款"
	case -1:
		return "已过期"
	default:
		return "未知"
	}
}

func generateOrderNo() string {
	return fmt.Sprintf("PAY%s%06d", time.Now().Format("20060102150405"), time.Now().UnixNano()%1000000)
}

func getExamFee(exam *model.Exam) float64 {
	baseFee := map[string]float64{
		"初级": 150.0,
		"中级": 200.0,
		"高级": 300.0,
	}
	if fee, ok := baseFee[exam.Level]; ok {
		return fee
	}
	return 200.0
}

func CreatePayment(c *gin.Context) {
	var req CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	userID := GetUserID(c)
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "请先登录")
		return
	}

	var apply model.ExamApply
	if err := model.DB.Preload("Exam").Preload("Trade").Where("id = ? AND user_id = ?", req.ApplyID, userID).First(&apply).Error; err != nil {
		Error(c, http.StatusNotFound, "报名记录不存在")
		return
	}

	if apply.PayStatus == 1 {
		Error(c, http.StatusBadRequest, "该报名已完成支付，无需重复支付")
		return
	}

	var existingOrder model.PaymentOrder
	if err := model.DB.Where("apply_id = ? AND pay_status = 0", req.ApplyID).First(&existingOrder).Error; err == nil {
		existingOrder.PayChannel = req.PayChannel
		existingOrder.ExpireTime = time.Now().Add(30 * time.Minute)
		if req.ReturnUrl != "" {
			existingOrder.ReturnUrl = req.ReturnUrl
		}
		model.DB.Save(&existingOrder)

		vo := buildPaymentVO(&existingOrder, apply.Exam.Name)
		Success(c, vo)
		return
	}

	amount := getExamFee(&apply.Exam)
	order := model.PaymentOrder{
		OrderNo:    generateOrderNo(),
		UserID:     userID,
		ApplyID:    req.ApplyID,
		ExamID:     apply.ExamID,
		Amount:     amount,
		PayChannel: req.PayChannel,
		PayStatus:  0,
		ExpireTime: time.Now().Add(30 * time.Minute),
		ReturnUrl:  req.ReturnUrl,
		Remark:     fmt.Sprintf("%s-%s考试报名费", apply.Trade.Name, apply.Exam.Level),
	}

	if err := model.DB.Create(&order).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建支付订单失败: "+err.Error())
		return
	}

	vo := buildPaymentVO(&order, apply.Exam.Name)

	switch req.PayChannel {
	case "wechat":
		vo.PayUrl = fmt.Sprintf("/pay/wechat/%s", order.OrderNo)
		vo.QrCode = fmt.Sprintf("weixin://wxpay/bizpayurl?pr=%s", order.OrderNo)
	case "alipay":
		vo.PayUrl = fmt.Sprintf("/pay/alipay/%s", order.OrderNo)
	case "bank":
		vo.PayUrl = fmt.Sprintf("/pay/bank/%s", order.OrderNo)
	}

	Success(c, vo)
}

func buildPaymentVO(order *model.PaymentOrder, examName string) PaymentVO {
	return PaymentVO{
		ID:            order.ID,
		OrderNo:       order.OrderNo,
		ApplyID:       order.ApplyID,
		ExamID:        order.ExamID,
		ExamName:      examName,
		Amount:        order.Amount,
		PayChannel:    order.PayChannel,
		PayStatus:     order.PayStatus,
		PayStatusText: getPayStatusText(order.PayStatus),
		ThirdPartyNo:  order.ThirdPartyNo,
		PayTime:       order.PayTime,
		ExpireTime:    order.ExpireTime,
		CreatedAt:     order.CreatedAt,
	}
}

func GetPaymentList(c *gin.Context) {
	page, pageSize := GetPageParams(c)
	userID := GetUserID(c)
	userRole := GetUserRole(c)

	query := model.DB.Model(&model.PaymentOrder{}).Preload("Exam")

	if userRole == "examinee" {
		query = query.Where("user_id = ?", userID)
	}

	status := c.Query("status")
	if status != "" {
		statusInt, _ := strconv.Atoi(status)
		query = query.Where("pay_status = ?", statusInt)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	var orders []model.PaymentOrder
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&orders).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	result := make([]PaymentVO, 0, len(orders))
	for _, order := range orders {
		examName := ""
		if order.Exam.ID > 0 {
			examName = order.Exam.Name
		}
		result = append(result, buildPaymentVO(&order, examName))
	}

	PageSuccess(c, result, total, page, pageSize)
}

func GetPaymentDetail(c *gin.Context) {
	orderNo := c.Param("orderNo")
	if orderNo == "" {
		Error(c, http.StatusBadRequest, "订单号不能为空")
		return
	}

	userID := GetUserID(c)
	userRole := GetUserRole(c)

	var order model.PaymentOrder
	query := model.DB.Preload("Exam").Where("order_no = ?", orderNo)
	if userRole == "examinee" {
		query = query.Where("user_id = ?", userID)
	}

	if err := query.First(&order).Error; err != nil {
		Error(c, http.StatusNotFound, "支付订单不存在")
		return
	}

	examName := ""
	if order.Exam.ID > 0 {
		examName = order.Exam.Name
	}
	vo := buildPaymentVO(&order, examName)
	Success(c, vo)
}

type PayNotifyRequest struct {
	OrderNo      string  `json:"orderNo" binding:"required"`
	ThirdPartyNo string  `json:"thirdPartyNo"`
	PayAmount    float64 `json:"payAmount"`
	PayStatus    int     `json:"payStatus" binding:"required"`
	Sign         string  `json:"sign"`
}

func PaymentNotify(c *gin.Context) {
	var req PayNotifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误", "data": nil})
		return
	}

	var order model.PaymentOrder
	if err := model.DB.Where("order_no = ?", req.OrderNo).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "订单不存在", "data": nil})
		return
	}

	if order.PayStatus == 1 {
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": nil})
		return
	}

	tx := model.DB.Begin()

	now := time.Now()
	order.PayStatus = req.PayStatus
	order.ThirdPartyNo = req.ThirdPartyNo
	order.PayTime = &now
	if req.PayAmount > 0 {
		order.Amount = req.PayAmount
	}

	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "更新订单失败", "data": nil})
		return
	}

	if req.PayStatus == 1 {
		var apply model.ExamApply
		if err := tx.Where("id = ?", order.ApplyID).First(&apply).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "报名记录不存在", "data": nil})
			return
		}

		apply.PayStatus = 1
		apply.PayAmount = order.Amount
		apply.PayTime = &now
		apply.ApplyStatus = 1

		if err := tx.Save(&apply).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "更新报名状态失败", "data": nil})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "提交事务失败", "data": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": nil})
}

func MockPay(c *gin.Context) {
	orderNo := c.Param("orderNo")
	channel := c.Query("channel")

	var order model.PaymentOrder
	if err := model.DB.Where("order_no = ? AND pay_status = 0", orderNo).First(&order).Error; err != nil {
		Error(c, http.StatusNotFound, "待支付订单不存在")
		return
	}

	thirdPartyNo := fmt.Sprintf("MOCK%s%d", channel, time.Now().Unix())

	tx := model.DB.Begin()

	now := time.Now()
	order.PayStatus = 1
	order.ThirdPartyNo = thirdPartyNo
	order.PayTime = &now

	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		Error(c, http.StatusInternalServerError, "模拟支付失败: "+err.Error())
		return
	}

	var apply model.ExamApply
	if err := tx.Where("id = ?", order.ApplyID).First(&apply).Error; err != nil {
		tx.Rollback()
		Error(c, http.StatusInternalServerError, "报名记录不存在")
		return
	}

	apply.PayStatus = 1
	apply.PayAmount = order.Amount
	apply.PayTime = &now
	apply.ApplyStatus = 1

	if err := tx.Save(&apply).Error; err != nil {
		tx.Rollback()
		Error(c, http.StatusInternalServerError, "更新报名状态失败")
		return
	}

	if err := tx.Commit().Error; err != nil {
		Error(c, http.StatusInternalServerError, "提交事务失败")
		return
	}

	Success(c, gin.H{
		"orderNo":      orderNo,
		"status":       "paid",
		"thirdPartyNo": thirdPartyNo,
		"payTime":      now,
		"amount":       order.Amount,
		"message":      "支付成功",
	})
}

func RefundPayment(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	var order model.PaymentOrder
	if err := model.DB.Where("id = ?", id).First(&order).Error; err != nil {
		Error(c, http.StatusNotFound, "支付订单不存在")
		return
	}

	if order.PayStatus != 1 {
		Error(c, http.StatusBadRequest, "仅已支付订单可申请退款")
		return
	}

	tx := model.DB.Begin()

	order.PayStatus = 2
	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		Error(c, http.StatusInternalServerError, "退款失败")
		return
	}

	var apply model.ExamApply
	if err := tx.Where("id = ?", order.ApplyID).First(&apply).Error; err == nil {
		apply.PayStatus = 2
		if err := tx.Save(&apply).Error; err != nil {
			tx.Rollback()
			Error(c, http.StatusInternalServerError, "更新报名状态失败")
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		Error(c, http.StatusInternalServerError, "提交事务失败")
		return
	}

	Success(c, gin.H{
		"orderNo": order.OrderNo,
		"status":  "refunded",
		"message": "退款成功",
	})
}
