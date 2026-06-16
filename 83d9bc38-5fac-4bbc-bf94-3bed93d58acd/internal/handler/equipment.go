package handler

import (
	"net/http"
	"strconv"
	"time"

	"equipment-booking/internal/middleware"
	"equipment-booking/internal/model"
	"equipment-booking/internal/service"

	"github.com/labstack/echo/v4"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type PaginatedData struct {
	Items    interface{} `json:"items"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

type EquipmentHandler struct {
	equipmentService service.EquipmentService
}

func NewEquipmentHandler(equipmentService service.EquipmentService) *EquipmentHandler {
	return &EquipmentHandler{
		equipmentService: equipmentService,
	}
}

func successResponse(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func errorResponse(c echo.Context, code int, message string) error {
	return c.JSON(code, Response{
		Code:    code,
		Message: message,
	})
}

func getClientIP(c echo.Context) string {
	ip := c.Request().Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = c.RealIP()
	}
	return ip
}

// GetEquipmentList 获取设备列表
// @Summary 获取设备列表
// @Description 分页获取设备列表，支持按中心、类别、状态筛选
// @Tags 设备管理
// @Accept json
// @Produce json
// @Param center_id query string false "中心ID"
// @Param category query string false "设备类别"
// @Param status query string false "设备状态"
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页数量" default(10)
// @Success 200 {object} Response{data=PaginatedData{items=[]model.Equipment}} "成功"
// @Failure 400 {object} Response "参数错误"
// @Failure 401 {object} Response "未授权"
// @Router /api/equipment [get]
// @Security BearerAuth
func (h *EquipmentHandler) GetEquipmentList(c echo.Context) error {
	ctx := c.Request().Context()

	var centerID, category, status *string
	if c.QueryParam("center_id") != "" {
		v := c.QueryParam("center_id")
		centerID = &v
	}
	if c.QueryParam("category") != "" {
		v := c.QueryParam("category")
		category = &v
	}
	if c.QueryParam("status") != "" {
		v := c.QueryParam("status")
		status = &v
	}

	pagination := &model.PaginationParams{
		Page:     1,
		PageSize: 10,
	}

	if pageStr := c.QueryParam("page"); pageStr != "" {
		if page, err := strconv.Atoi(pageStr); err == nil && page > 0 {
			pagination.Page = page
		}
	}
	if pageSizeStr := c.QueryParam("page_size"); pageSizeStr != "" {
		if pageSize, err := strconv.Atoi(pageSizeStr); err == nil && pageSize > 0 {
			pagination.PageSize = pageSize
		}
	}

	result, err := h.equipmentService.GetEquipmentList(ctx, centerID, category, status, pagination)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return successResponse(c, PaginatedData{
		Items:    result.Items,
		Total:    result.Total,
		Page:     result.Page,
		PageSize: result.PageSize,
	})
}

// GetEquipmentDetail 获取设备详情
// @Summary 获取设备详情
// @Description 根据ID获取设备详细信息，包括当前预约、下次空闲时间和即将到来的预约
// @Tags 设备管理
// @Accept json
// @Produce json
// @Param id path int true "设备ID"
// @Success 200 {object} Response{data=service.EquipmentDetail} "成功"
// @Failure 400 {object} Response "参数错误"
// @Failure 401 {object} Response "未授权"
// @Failure 404 {object} Response "设备不存在"
// @Router /api/equipment/{id} [get]
// @Security BearerAuth
func (h *EquipmentHandler) GetEquipmentDetail(c echo.Context) error {
	ctx := c.Request().Context()

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的设备ID")
	}

	detail, err := h.equipmentService.GetEquipmentDetail(ctx, id)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return successResponse(c, detail)
}

// CreateEquipment 创建设备
// @Summary 创建设备
// @Description 创建新设备（需要管理员权限）
// @Tags 设备管理
// @Accept json
// @Produce json
// @Param equipment body model.Equipment true "设备信息"
// @Success 201 {object} Response{data=model.Equipment} "创建成功"
// @Failure 400 {object} Response "参数错误"
// @Failure 401 {object} Response "未授权"
// @Failure 403 {object} Response "权限不足"
// @Router /api/equipment [post]
// @Security BearerAuth
func (h *EquipmentHandler) CreateEquipment(c echo.Context) error {
	ctx := c.Request().Context()

	user, ok := middleware.GetUser(ctx)
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	if !middleware.HasRole(ctx, middleware.RoleSuperAdmin, middleware.RoleCenterAdmin) {
		return errorResponse(c, http.StatusForbidden, "权限不足")
	}

	var equipment model.Equipment
	if err := c.Bind(&equipment); err != nil {
		return errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
	}

	ipAddress := getClientIP(c)
	var userID *uint64
	if user != nil {
		userID = &user.UserID
	}

	created, err := h.equipmentService.CreateEquipment(ctx, &equipment, userID, ipAddress)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusCreated, Response{
		Code:    0,
		Message: "success",
		Data:    created,
	})
}

// UpdateEquipment 更新设备
// @Summary 更新设备
// @Description 更新设备信息（需要管理员权限）
// @Tags 设备管理
// @Accept json
// @Produce json
// @Param id path int true "设备ID"
// @Param equipment body model.Equipment true "设备信息"
// @Success 200 {object} Response{data=model.Equipment} "更新成功"
// @Failure 400 {object} Response "参数错误"
// @Failure 401 {object} Response "未授权"
// @Failure 403 {object} Response "权限不足"
// @Failure 404 {object} Response "设备不存在"
// @Router /api/equipment/{id} [put]
// @Security BearerAuth
func (h *EquipmentHandler) UpdateEquipment(c echo.Context) error {
	ctx := c.Request().Context()

	user, ok := middleware.GetUser(ctx)
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	if !middleware.HasRole(ctx, middleware.RoleSuperAdmin, middleware.RoleCenterAdmin) {
		return errorResponse(c, http.StatusForbidden, "权限不足")
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的设备ID")
	}

	var equipment model.Equipment
	if err := c.Bind(&equipment); err != nil {
		return errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
	}
	equipment.ID = id

	ipAddress := getClientIP(c)
	var userID *uint64
	if user != nil {
		userID = &user.UserID
	}

	updated, err := h.equipmentService.UpdateEquipment(ctx, &equipment, userID, ipAddress)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return successResponse(c, updated)
}

// UpdateEquipmentStatus 更新设备状态
// @Summary 更新设备状态
// @Description 更新设备状态（available/maintenance/scrapped）
// @Tags 设备管理
// @Accept json
// @Produce json
// @Param id path int true "设备ID"
// @Param status body object{status=string,remark=string} true "状态信息"
// @Success 200 {object} Response{data=model.Equipment} "更新成功"
// @Failure 400 {object} Response "参数错误"
// @Failure 401 {object} Response "未授权"
// @Failure 403 {object} Response "权限不足"
// @Failure 404 {object} Response "设备不存在"
// @Router /api/equipment/{id}/status [patch]
// @Security BearerAuth
func (h *EquipmentHandler) UpdateEquipmentStatus(c echo.Context) error {
	ctx := c.Request().Context()

	user, ok := middleware.GetUser(ctx)
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的设备ID")
	}

	var req struct {
		Status string `json:"status"`
		Remark string `json:"remark"`
	}
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
	}

	if req.Status == "" {
		return errorResponse(c, http.StatusBadRequest, "状态不能为空")
	}

	updated, err := h.equipmentService.UpdateEquipmentStatus(ctx, id, req.Status, user.UserID, req.Remark)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, err.Error())
	}

	return successResponse(c, updated)
}

// GetEquipmentStats 获取设备统计信息
// @Summary 获取设备统计信息
// @Description 获取指定设备在指定时间范围内的统计信息
// @Tags 设备管理
// @Accept json
// @Produce json
// @Param id path int true "设备ID"
// @Param start_time query string false "开始时间 RFC3339格式" default(2024-01-01T00:00:00Z)
// @Param end_time query string false "结束时间 RFC3339格式" default(2024-12-31T23:59:59Z)
// @Success 200 {object} Response{data=[]service.EquipmentStats} "成功"
// @Failure 400 {object} Response "参数错误"
// @Failure 401 {object} Response "未授权"
// @Router /api/equipment/{id}/stats [get]
// @Security BearerAuth
func (h *EquipmentHandler) GetEquipmentStats(c echo.Context) error {
	ctx := c.Request().Context()

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的设备ID")
	}

	now := time.Now()
	startTime := now.AddDate(0, 0, -30)
	endTime := now

	if startStr := c.QueryParam("start_time"); startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			startTime = t
		}
	}
	if endStr := c.QueryParam("end_time"); endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			endTime = t
		}
	}

	equipmentIDs := []uint64{id}
	stats, err := h.equipmentService.GetEquipmentStats(ctx, equipmentIDs, startTime, endTime)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, err.Error())
	}

	return successResponse(c, stats)
}

// RegisterRoutes 注册设备管理路由
func (h *EquipmentHandler) RegisterRoutes(e *echo.Group, authMiddleware echo.MiddlewareFunc) {
	equipment := e.Group("/equipment")
	equipment.Use(authMiddleware)

	equipment.GET("", h.GetEquipmentList)
	equipment.GET("/:id", h.GetEquipmentDetail)
	equipment.POST("", h.CreateEquipment)
	equipment.PUT("/:id", h.UpdateEquipment)
	equipment.PATCH("/:id/status", h.UpdateEquipmentStatus)
	equipment.GET("/:id/stats", h.GetEquipmentStats)
}
