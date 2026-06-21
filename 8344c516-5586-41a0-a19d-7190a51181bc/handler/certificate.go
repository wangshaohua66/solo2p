package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/skip2/go-qrcode"
	"exam-system/model"
	_ "exam-system/middleware"
)

type GenerateCertificatesRequest struct {
	ExamID uint `json:"examId" binding:"required"`
}

func GetCertificateList(c *gin.Context) {
	page, pageSize := GetPageParams(c)

	userRole := GetUserRole(c)
	userID := GetUserID(c)

	tradeID := c.Query("tradeId")
	status := c.Query("status")

	query := model.DB.Model(&model.Certificate{}).Preload("User").Preload("Trade")

	if userRole == RoleExaminee {
		query = query.Where("user_id = ?", userID)
	}

	if tradeID != "" {
		query = query.Where("trade_id = ?", tradeID)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	var certificates []model.Certificate
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&certificates).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	PageSuccess(c, certificates, total, page, pageSize)
}

func GenerateCertificates(c *gin.Context) {
	var req GenerateCertificatesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	var exam model.Exam
	if err := model.DB.Where("id = ?", req.ExamID).First(&exam).Error; err != nil {
		Error(c, http.StatusNotFound, "考期不存在")
		return
	}

	if exam.Status != 3 {
		Error(c, http.StatusBadRequest, "考期未完成，无法生成证书")
		return
	}

	var scores []model.Score
	if err := model.DB.Where("exam_id = ? AND pass_status = 1 AND score_status = 1", req.ExamID).
		Preload("User").Preload("Trade").Find(&scores).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	if len(scores) == 0 {
		Error(c, http.StatusBadRequest, "没有符合条件的合格考生")
		return
	}

	var generatedCount int
	issuedDate := time.Now()
	expiryDate := issuedDate.AddDate(5, 0, 0)

	for _, score := range scores {
		var existingCert model.Certificate
		if err := model.DB.Where("score_id = ?", score.ID).First(&existingCert).Error; err == nil {
			continue
		}

		certificateNo := fmt.Sprintf("CERT%s%06d", issuedDate.Format("20060102"), score.ID)
		verifyCode := fmt.Sprintf("%s%04d", issuedDate.Format("2006"), score.ID)
		verifyUrl := fmt.Sprintf("/api/certificates/verify/%s", verifyCode)

		qrData := fmt.Sprintf("证书编号:%s|验证码:%s|姓名:%s|工种:%s|等级:%s",
			certificateNo, verifyCode, score.User.RealName, score.Trade.Name, score.Trade.Level)

		qrCode, err := qrcode.Encode(qrData, qrcode.Medium, 256)
		if err != nil {
			continue
		}

		qrCodeBase64 := fmt.Sprintf("data:image/png;base64,%s", []byte(qrCode))

		certificate := model.Certificate{
			CertificateNo: certificateNo,
			UserID:        score.UserID,
			TradeID:       score.TradeID,
			Level:         score.Trade.Level,
			LevelCode:     score.Trade.LevelCode,
			ScoreID:       score.ID,
			IssuedDate:    issuedDate,
			ExpiryDate:    &expiryDate,
			QrCode:        qrCodeBase64,
			VerifyUrl:     verifyUrl,
			Status:        1,
		}

		if err := model.DB.Create(&certificate).Error; err != nil {
			continue
		}

		generatedCount++
	}

	Success(c, gin.H{
		"generatedCount": generatedCount,
		"totalCount":     len(scores),
	})
}

func DownloadCertificate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	userRole := GetUserRole(c)
	userID := GetUserID(c)

	var certificate model.Certificate
	if err := model.DB.Preload("User").Preload("Trade").Preload("Score").
		Where("id = ?", id).First(&certificate).Error; err != nil {
		Error(c, http.StatusNotFound, "证书不存在")
		return
	}

	if userRole == RoleExaminee && certificate.UserID != userID {
		Error(c, http.StatusForbidden, "无权下载他人证书")
		return
	}

	model.DB.Model(&certificate).Update("print_count", certificate.PrintCount+1)

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>职业技能等级证书</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: "Microsoft YaHei", sans-serif; background: #f5f5f5; padding: 20px; }
        .certificate { width: 800px; margin: 0 auto; background: #fff; padding: 60px; border: 8px solid #d4af37; position: relative; }
        .header { text-align: center; margin-bottom: 40px; }
        .title { font-size: 36px; font-weight: bold; color: #333; letter-spacing: 8px; margin-bottom: 10px; }
        .subtitle { font-size: 18px; color: #666; }
        .content { margin: 40px 0; font-size: 16px; line-height: 2.5; }
        .info-row { display: flex; margin-bottom: 10px; }
        .info-label { width: 120px; color: #666; }
        .info-value { flex: 1; color: #333; font-weight: bold; border-bottom: 1px solid #ddd; }
        .footer { margin-top: 60px; text-align: right; }
        .qr-code { position: absolute; bottom: 60px; left: 60px; }
        .qr-code img { width: 100px; height: 100px; }
        .cert-no { position: absolute; top: 20px; right: 60px; font-size: 14px; color: #999; }
        .verify-code { position: absolute; top: 45px; right: 60px; font-size: 14px; color: #999; }
        .stamp { position: absolute; bottom: 120px; right: 120px; width: 120px; height: 120px; border: 3px solid #d4af37; border-radius: 50%%; display: flex; align-items: center; justify-content: center; color: #d4af37; font-size: 14px; font-weight: bold; transform: rotate(-15deg); opacity: 0.8; }
        @media print {
            body { background: #fff; padding: 0; }
            .certificate { border: none; }
        }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="cert-no">证书编号：%s</div>
        <div class="verify-code">验证码：%s</div>
        <div class="header">
            <div class="title">职业技能等级证书</div>
            <div class="subtitle">OCCUPATIONAL SKILLS CERTIFICATE</div>
        </div>
        <div class="content">
            <div class="info-row">
                <span class="info-label">持证人：</span>
                <span class="info-value">%s</span>
            </div>
            <div class="info-row">
                <span class="info-label">身份证号：</span>
                <span class="info-value">%s</span>
            </div>
            <div class="info-row">
                <span class="info-label">职业（工种）：</span>
                <span class="info-value">%s</span>
            </div>
            <div class="info-row">
                <span class="info-label">技能等级：</span>
                <span class="info-value">%s</span>
            </div>
            <div class="info-row">
                <span class="info-label">理论成绩：</span>
                <span class="info-value">%.2f</span>
            </div>
            <div class="info-row">
                <span class="info-label">实操成绩：</span>
                <span class="info-value">%.2f</span>
            </div>
            <div class="info-row">
                <span class="info-label">综合成绩：</span>
                <span class="info-value">%.2f</span>
            </div>
            <div class="info-row">
                <span class="info-label">发证日期：</span>
                <span class="info-value">%s</span>
            </div>
            <div class="info-row">
                <span class="info-label">有效期至：</span>
                <span class="info-value">%s</span>
            </div>
        </div>
        <div class="footer">
            <div>发证机构：职业技能鉴定中心</div>
            <div style="margin-top: 10px;">%s</div>
        </div>
        <div class="qr-code">
            <img src="%s" alt="二维码">
            <div style="font-size: 12px; text-align: center; margin-top: 5px;">扫码验证</div>
        </div>
        <div class="stamp">职业技能<br>鉴定专用章</div>
    </div>
</body>
</html>`,
		certificate.CertificateNo,
		certificate.CertificateNo[len(certificate.CertificateNo)-10:],
		certificate.User.RealName,
		maskIDCard(certificate.User.IDCard),
		certificate.Trade.Name,
		certificate.Level,
		*certificate.Score.TheoryScore,
		*certificate.Score.PracticeScore,
		*certificate.Score.TotalScore,
		certificate.IssuedDate.Format("2006年01月02日"),
		certificate.ExpiryDate.Format("2006年01月02日"),
		certificate.IssuedDate.Format("2006年01月02日"),
		certificate.QrCode,
	)

	c.Header("Content-Type", "text/html; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=certificate_%s.html", certificate.CertificateNo))
	c.String(http.StatusOK, html)
}

func VerifyCertificate(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		Error(c, http.StatusBadRequest, "验证码不能为空")
		return
	}

	var certificate model.Certificate
	if err := model.DB.Preload("User").Preload("Trade").Preload("Score").
		Where("certificate_no LIKE ?", "%"+code).First(&certificate).Error; err != nil {
		Success(c, gin.H{
			"valid":   false,
			"message": "证书不存在或验证码错误",
		})
		return
	}

	now := time.Now()
	status := "有效"
	if certificate.Status != 1 {
		status = "已作废"
	} else if certificate.ExpiryDate != nil && now.After(*certificate.ExpiryDate) {
		status = "已过期"
	}

	Success(c, gin.H{
		"valid":   true,
		"status":  status,
		"message": "证书查询成功",
		"data": gin.H{
			"certificateNo": certificate.CertificateNo,
			"holderName":    certificate.User.RealName,
			"idCard":        maskIDCard(certificate.User.IDCard),
			"tradeName":     certificate.Trade.Name,
			"level":         certificate.Level,
			"totalScore":    *certificate.Score.TotalScore,
			"issuedDate":    certificate.IssuedDate.Format("2006-01-02"),
			"expiryDate":    certificate.ExpiryDate.Format("2006-01-02"),
		},
	})
}

func maskIDCard(idCard string) string {
	if len(idCard) != 18 {
		return idCard
	}
	return idCard[:6] + "********" + idCard[14:]
}
