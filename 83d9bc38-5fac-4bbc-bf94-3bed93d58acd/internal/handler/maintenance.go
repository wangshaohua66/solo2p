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

type MaintenanceHandler struct {
	maintenanceService service.MaintenanceService
}

func NewMaintenanceHandler(maintenanceService service.MaintenanceService) *MaintenanceHandler {
	return &MaintenanceHandler{
		maintenanceService: maintenanceService,
	}
}

type createMaintenanceRequest struct {
	EquipmentID uint64    `json:"equipmentId" form:"equipmentId"`
	StartTime   time.Time `json:"startTime" form:"startTime"`
	EndTime     time.Time `json:"endTime" form:"endTime"`
	Type        string    `json:"type" form:"type"`
	Remark      string    `json:"remark" form:"remark"`
}

type updateMaintenanceRequest struct {
	StartTime *time.Time `json:"startTime" form:"startTime"`
	EndTime   *time.Time `json:"endTime" form:"endTime"`
	Type      *string    `json:"type" form:"type"`
	Remark    *string    `json:"remark" form:"remark"`
}

type completeMaintenanceRequest struct {
	Remark string `json:"remark" form:"remark"`
}

func (h *MaintenanceHandler) RegisterRoutes(e *echo.Group) {
	maintenance := e.Group("/maintenance")
	{
		maintenance.GET("", h.GetList, middleware.RBAC("maintenance:read"))
		maintenance.POST("", h.Create, middleware.RBAC("maintenance:create"))
		maintenance.PUT("/:id", h.Update, middleware.RBAC("maintenance:update"))
		maintenance.POST("/:id/complete", h.Complete, middleware.RBAC("maintenance:complete"))
		maintenance.DELETE("/:id", h.Cancel, middleware.RBAC("maintenance:delete"))
	}
}

func (h *MaintenanceHandler) GetList(c echo.Context) error {
	var equipmentID *uint64
	var startTime *time.Time
	var endTime *time.Time
	var status *string

	if equipmentIDStr := c.QueryParam("equipment_id"); equipmentIDStr != "" {
		id, err := strconv.ParseUint(equipmentIDStr, 10, 64)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, "无效的设备ID")
		}
		equipmentID = &id
	}

	if startTimeStr := c.QueryParam("start_time"); startTimeStr != "" {
		t, err := time.Parse(time.RFC3339, startTimeStr)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, "无效的开始时间格式，请使用RFC3339格式")
		}
		startTime = &t
	}

	if endTimeStr := c.QueryParam("end_time"); endTimeStr != "" {
		t, err := time.Parse(time.RFC3339, endTimeStr)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, "无效的结束时间格式，请使用RFC3339格式")
		}
		endTime = &t
	}

	if statusStr := c.QueryParam("status"); statusStr != "" {
		status = &statusStr
	}

	page := 1
	if pageStr := c.QueryParam("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	pageSize := 10
	if pageSizeStr := c.QueryParam("page_size"); pageSizeStr != "" {
		if ps, err := strconv.Atoi(pageSizeStr); err == nil && ps > 0 {
			pageSize = ps
		}
	}

	pagination := &model.PaginationParams{
		Page:     page,
		PageSize: pageSize,
	}

	result, err := h.maintenanceService.GetMaintenanceList(
		c.Request().Context(),
		equipmentID,
		startTime,
		endTime,
		pagination,
	)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, "获取维护计划列表失败: "+err.Error())
	}

	if status != nil {
		filtered := make([]model.Maintenance, 0, len(result.Items))
		for _, m := range result.Items {
			if m.Status == *status {
				filtered = append(filtered, m)
			}
		}
		result.Items = filtered
		result.Total = int64(len(filtered))
	}

	return successResponse(c, result)
}

func (h *MaintenanceHandler) Create(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	var req createMaintenanceRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
	}

	if req.EquipmentID == 0 {
		return errorResponse(c, http.StatusBadRequest, "设备ID不能为空")
	}
	if req.StartTime.IsZero() {
		return errorResponse(c, http.StatusBadRequest, "开始时间不能为空")
	}
	if req.EndTime.IsZero() {
		return errorResponse(c, http.StatusBadRequest, "结束时间不能为空")
	}
	if req.Type == "" {
		return errorResponse(c, http.StatusBadRequest, "维护类型不能为空")
	}
	if req.StartTime.After(req.EndTime) {
		return errorResponse(c, http.StatusBadRequest, "开始时间必须早于结束时间")
	}
	if req.StartTime.Before(time.Now()) {
		return errorResponse(c, http.StatusBadRequest, "维护开始时间不能早于当前时间")
	}

	maintenance := &model.Maintenance{
		EquipmentID: req.EquipmentID,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Type:        req.Type,
		Remark:      req.Remark,
	}

	result, err := h.maintenanceService.CreateMaintenance(
		c.Request().Context(),
		maintenance,
		user.UserID,
	)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "创建维护计划失败: "+err.Error())
	}

	return successResponse(c, result)
}

func (h *MaintenanceHandler) Update(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的维护计划ID")
	}

	var req updateMaintenanceRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
	}

	updates := &model.Maintenance{}
	if req.StartTime != nil {
		updates.StartTime = *req.StartTime
	}
	if req.EndTime != nil {
		updates.EndTime = *req.EndTime
	}
	if req.Type != nil {
		updates.Type = *req.Type
	}
	if req.Remark != nil {
		updates.Remark = *req.Remark
	}

	if req.StartTime != nil && req.EndTime != nil {
		if req.StartTime.After(*req.EndTime) {
			return errorResponse(c, http.StatusBadRequest, "开始时间必须早于结束时间")
		}
		if req.StartTime.Before(time.Now()) {
			return errorResponse(c, http.StatusBadRequest, "维护开始时间不能早于当前时间")
		}
	}

	result, err := h.maintenanceService.UpdateMaintenance(
		c.Request().Context(),
		id,
		updates,
		user.UserID,
	)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "更新维护计划失败: "+err.Error())
	}

	return successResponse(c, result)
}

func (h *MaintenanceHandler) Complete(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的维护计划ID")
	}

	var req completeMaintenanceRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
	}

	result, err := h.maintenanceService.CompleteMaintenance(
		c.Request().Context(),
		id,
		user.UserID,
		req.Remark,
	)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "完成维护失败: "+err.Error())
	}

	return successResponse(c, result)
}

func (h *MaintenanceHandler) Cancel(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的维护计划ID")
	}

	result, err := h.maintenanceService.CancelMaintenance(
		c.Request().Context(),
		id,
		user.UserID,
	)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "取消维护计划失败: "+err.Error())
	}

	return successResponse(c, result)
}
