package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"exhibition-center/internal/models"
	"exhibition-center/internal/repositories"
)

type BoothHandler struct {
	repo *repositories.BoothRepository
}

func NewBoothHandler() *BoothHandler {
	return &BoothHandler{
		repo: repositories.NewBoothRepository(models.DB),
	}
}

// ListBooths godoc
// @Summary 获取展位列表
// @Description 获取展位列表，支持按展厅、状态、区域筛选
// @Tags 展位管理
// @Produce json
// @Security BearerAuth
// @Param venueId query string false "展厅ID"
// @Param status query string false "状态"
// @Param zone query string false "区域"
// @Success 200 {object} APIResponse{data=[]models.Booth}
// @Router /api/booths [get]
func (h *BoothHandler) List(c echo.Context) error {
	venueID := c.QueryParam("venueId")
	status := c.QueryParam("status")
	zone := c.QueryParam("zone")

	booths, err := h.repo.List(venueID, status, zone)
	if err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}
	return SuccessResponse(c, booths)
}

// GetBooth godoc
// @Summary 获取展位详情
// @Description 根据ID获取展位详情
// @Tags 展位管理
// @Produce json
// @Security BearerAuth
// @Param id path string true "展位ID"
// @Success 200 {object} APIResponse{data=models.Booth}
// @Router /api/booths/{id} [get]
func (h *BoothHandler) Get(c echo.Context) error {
	id := c.Param("id")
	booth, err := h.repo.GetByID(id)
	if err != nil {
		return ErrorResponse(c, http.StatusNotFound, "展位不存在")
	}
	return SuccessResponse(c, booth)
}

// CreateBooth godoc
// @Summary 创建展位
// @Description 创建新展位
// @Tags 展位管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body models.Booth true "展位信息"
// @Success 200 {object} APIResponse{data=models.Booth}
// @Router /api/booths [post]
func (h *BoothHandler) Create(c echo.Context) error {
	var booth models.Booth
	if err := c.Bind(&booth); err != nil {
		return ErrorResponse(c, http.StatusBadRequest, "请求参数错误")
	}

	if booth.Status == "" {
		booth.Status = models.BoothStatusAvailable
	}
	if booth.Area == 0 {
		booth.Area = (booth.Width / 100) * (booth.Height / 100)
	}
	if booth.PricePerSquare == 0 && booth.Price > 0 && booth.Area > 0 {
		booth.PricePerSquare = booth.Price / booth.Area
	}

	if err := h.repo.Create(&booth); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return SuccessResponse(c, booth)
}

// UpdateBooth godoc
// @Summary 更新展位
// @Description 更新展位信息，包括位置、大小、价格、状态等
// @Tags 展位管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "展位ID"
// @Param request body map[string]interface{} true "更新字段"
// @Success 200 {object} APIResponse{data=models.Booth}
// @Router /api/booths/{id} [put]
func (h *BoothHandler) Update(c echo.Context) error {
	id := c.Param("id")

	var data map[string]interface{}
	if err := c.Bind(&data); err != nil {
		return ErrorResponse(c, http.StatusBadRequest, "请求参数错误")
	}

	data["updated_at"] = time.Now()

	if width, ok := data["width"].(float64); ok {
		if height, ok2 := data["height"].(float64); ok2 {
			data["area"] = (width / 100) * (height / 100)
		}
	}

	if price, ok := data["price"].(float64); ok {
		if area, ok2 := data["area"].(float64); ok2 && area > 0 {
			data["price_per_square"] = price / area
		}
	}

	if err := h.repo.Update(id, data); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	booth, _ := h.repo.GetByID(id)
	return SuccessResponse(c, booth)
}

// DeleteBooth godoc
// @Summary 删除展位
// @Description 删除展位
// @Tags 展位管理
// @Produce json
// @Security BearerAuth
// @Param id path string true "展位ID"
// @Success 200 {object} APIResponse
// @Router /api/booths/{id} [delete]
func (h *BoothHandler) Delete(c echo.Context) error {
	id := c.Param("id")
	if err := h.repo.Delete(id); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}
	return SuccessResponse(c, nil)
}

// BatchCreate godoc
// @Summary 批量创建展位
// @Description 批量创建多个展位
// @Tags 展位管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Router /api/booths/batch [post]
func (h *BoothHandler) BatchCreate(c echo.Context) error {
	var booths []models.Booth
	if err := c.Bind(&booths); err != nil {
		return ErrorResponse(c, http.StatusBadRequest, "请求参数错误")
	}

	for i := range booths {
		if booths[i].Status == "" {
			booths[i].Status = models.BoothStatusAvailable
		}
		if booths[i].Area == 0 {
			booths[i].Area = (booths[i].Width / 100) * (booths[i].Height / 100)
		}
	}

	if err := h.repo.BatchCreate(booths); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return SuccessResponse(c, map[string]interface{}{
		"created": len(booths),
		"booths":  booths,
	})
}

// ListVenues godoc
// @Summary 获取展厅列表
// @Description 获取所有可用展厅
// @Tags 展位管理
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse{data=[]models.Venue}
// @Router /api/venues [get]
func (h *BoothHandler) ListVenues(c echo.Context) error {
	venues, err := h.repo.ListVenues()
	if err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}
	return SuccessResponse(c, venues)
}

type VisitorHandler struct {
	repo *repositories.VisitorRepository
}

func NewVisitorHandler() *VisitorHandler {
	return &VisitorHandler{
		repo: repositories.NewVisitorRepository(models.DB),
	}
}

// ListVisitors godoc
// @Summary 获取访客记录列表
// @Description 分页获取访客签到记录
// @Tags 观众服务
// @Produce json
// @Security BearerAuth
// @Param page query int false "页码" default(1)
// @Param pageSize query int false "每页数量" default(20)
// @Param scheduleId query string false "展会ID"
// @Param keyword query string false "关键词搜索"
// @Success 200 {object} APIResponse
// @Router /api/visitors [get]
func (h *VisitorHandler) List(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	scheduleID := c.QueryParam("scheduleId")
	keyword := c.QueryParam("keyword")

	records, total, err := h.repo.List(page, pageSize, scheduleID, keyword)
	if err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return PageDataResponse(c, records, total, page, pageSize)
}

// GetVisitor godoc
// @Summary 获取访客详情
// @Description 根据ID获取访客详情，包含访问轨迹
// @Tags 观众服务
// @Produce json
// @Security BearerAuth
// @Param id path string true "访客ID"
// @Success 200 {object} APIResponse{data=models.VisitorRecord}
// @Router /api/visitors/{id} [get]
func (h *VisitorHandler) Get(c echo.Context) error {
	id := c.Param("id")
	record, err := h.repo.GetByID(id)
	if err != nil {
		return ErrorResponse(c, http.StatusNotFound, "访客记录不存在")
	}
	return SuccessResponse(c, record)
}

// CreateVisitor godoc
// @Summary 创建访客记录
// @Description 创建新的访客签到记录
// @Tags 观众服务
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body models.VisitorRecord true "访客信息"
// @Success 200 {object} APIResponse{data=models.VisitorRecord}
// @Router /api/visitors [post]
func (h *VisitorHandler) Create(c echo.Context) error {
	var record models.VisitorRecord
	if err := c.Bind(&record); err != nil {
		return ErrorResponse(c, http.StatusBadRequest, "请求参数错误")
	}

	if record.CheckInAt == "" {
		record.CheckInAt = time.Now().Format(time.RFC3339)
	}
	if record.QRCode == "" {
		record.QRCode = "VISITOR-" + time.Now().Format("20060102") + "-" + strconv.FormatInt(time.Now().Unix()%10000, 10)
	}

	if err := h.repo.Create(&record); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return SuccessResponse(c, record)
}

// CheckIn godoc
// @Summary 签到
// @Description 通过二维码扫描签到
// @Tags 观众服务
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse{data=models.VisitorRecord}
// @Router /api/visitors/checkin [post]
func (h *VisitorHandler) CheckIn(c echo.Context) error {
	var req struct {
		QRCode string `json:"qrCode" validate:"required"`
	}
	c.Bind(&req)

	record, err := h.repo.GetByQRCode(req.QRCode)
	if err != nil {
		return ErrorResponse(c, http.StatusNotFound, "无效的签到码")
	}

	if record.CheckInAt != "" {
		return ErrorResponse(c, http.StatusBadRequest, "已签到")
	}

	data := map[string]interface{}{
		"check_in_at": time.Now().Format(time.RFC3339),
	}

	if err := h.repo.Update(record.ID, data); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	record, _ = h.repo.GetByID(record.ID)
	return SuccessResponse(c, record)
}

// RecordBoothVisit godoc
// @Summary 记录展位访问
// @Description 记录访客访问展位的轨迹
// @Tags 观众服务
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "访客ID"
// @Success 200 {object} APIResponse{data=models.VisitorRecord}
// @Router /api/visitors/{id}/booth-visit [post]
func (h *VisitorHandler) RecordBoothVisit(c echo.Context) error {
	id := c.Param("id")

	var visit models.BoothVisit
	if err := c.Bind(&visit); err != nil {
		return ErrorResponse(c, http.StatusBadRequest, "请求参数错误")
	}

	if visit.VisitedAt.IsZero() {
		visit.VisitedAt = time.Now()
	}

	if err := h.repo.AddBoothVisit(id, visit); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	record, _ := h.repo.GetByID(id)
	return SuccessResponse(c, record)
}

// ListProviders godoc
// @Summary 获取服务商列表
// @Description 分页获取服务商列表
// @Tags 服务商管理
// @Produce json
// @Security BearerAuth
// @Param page query int false "页码" default(1)
// @Param pageSize query int false "每页数量" default(20)
// @Param status query string false "状态"
// @Param keyword query string false "关键词"
// @Success 200 {object} APIResponse
// @Router /api/providers [get]
func (h *VisitorHandler) ListProviders(c echo.Context) error {
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

	providers, total, err := h.repo.ListProviders(page, pageSize, status, keyword)
	if err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return PageDataResponse(c, providers, total, page, pageSize)
}

// GetProvider godoc
// @Summary 获取服务商详情
// @Description 根据ID获取服务商详情
// @Tags 服务商管理
// @Produce json
// @Security BearerAuth
// @Param id path string true "服务商ID"
// @Success 200 {object} APIResponse{data=models.ServiceProvider}
// @Router /api/providers/{id} [get]
func (h *VisitorHandler) GetProvider(c echo.Context) error {
	id := c.Param("id")
	provider, err := h.repo.GetProviderByID(id)
	if err != nil {
		return ErrorResponse(c, http.StatusNotFound, "服务商不存在")
	}
	return SuccessResponse(c, provider)
}

// CreateProvider godoc
// @Summary 创建服务商
// @Description 创建新服务商
// @Tags 服务商管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body models.ServiceProvider true "服务商信息"
// @Success 200 {object} APIResponse{data=models.ServiceProvider}
// @Router /api/providers [post]
func (h *VisitorHandler) CreateProvider(c echo.Context) error {
	var provider models.ServiceProvider
	if err := c.Bind(&provider); err != nil {
		return ErrorResponse(c, http.StatusBadRequest, "请求参数错误")
	}

	if provider.Status == "" {
		provider.Status = models.ProviderStatusPending
	}

	if err := h.repo.CreateProvider(&provider); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return SuccessResponse(c, provider)
}

// UpdateProvider godoc
// @Summary 更新服务商
// @Description 更新服务商信息
// @Tags 服务商管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "服务商ID"
// @Param request body map[string]interface{} true "更新字段"
// @Success 200 {object} APIResponse{data=models.ServiceProvider}
// @Router /api/providers/{id} [put]
func (h *VisitorHandler) UpdateProvider(c echo.Context) error {
	id := c.Param("id")

	var data map[string]interface{}
	if err := c.Bind(&data); err != nil {
		return ErrorResponse(c, http.StatusBadRequest, "请求参数错误")
	}

	if err := h.repo.UpdateProvider(id, data); err != nil {
		return ErrorResponse(c, http.StatusInternalServerError, err.Error())
	}

	provider, _ := h.repo.GetProviderByID(id)
	return SuccessResponse(c, provider)
}
