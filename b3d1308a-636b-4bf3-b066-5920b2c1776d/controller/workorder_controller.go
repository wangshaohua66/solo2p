package controller

import (
	"net/http"
	"time"

	"smart-lighting-api/middleware"
	"smart-lighting-api/model"
	"smart-lighting-api/pkg"
	"smart-lighting-api/repository"
	"smart-lighting-api/service"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

type WorkOrderController struct {
	workOrderRepo  *repository.WorkOrderRepo
	workOrderSvc   *service.WorkOrderService
	deviceService  *service.DeviceService
}

func NewWorkOrderController(
	workOrderRepo *repository.WorkOrderRepo,
	workOrderSvc *service.WorkOrderService,
	deviceService *service.DeviceService) *WorkOrderController {
	return &WorkOrderController{
		workOrderRepo: workOrderRepo,
		workOrderSvc:  workOrderSvc,
		deviceService: deviceService,
	}
}

type listWOQuery struct {
	AreaID     int64  `query:"area_id"`
	DeviceID   int64  `query:"device_id"`
	FaultID    int64  `query:"fault_id"`
	Status     string `query:"status"`
	Priority   string `query:"priority"`
	AssigneeID int64  `query:"assignee_id"`
	Keyword    string `query:"keyword"`
	StartDate  string `query:"start_date"`
	EndDate    string `query:"end_date"`
	Page       int    `query:"page"`
	PageSize   int    `query:"page_size"`
	Sort       string `query:"sort"`
}

func (c *WorkOrderController) ListWorkOrders(e echo.Context) error {
	ctx := e.Request().Context()
	var q listWOQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	var startDate, endDate time.Time
	if q.StartDate != "" {
		startDate, _ = time.Parse("2006-01-02", q.StartDate)
	}
	if q.EndDate != "" {
		endDate, _ = time.Parse("2006-01-02 15:04:05", q.EndDate+" 23:59:59")
	}
	params := &repository.WorkOrderQueryParams{
		AreaID:     q.AreaID,
		DeviceID:   q.DeviceID,
		FaultID:    q.FaultID,
		Status:     q.Status,
		Priority:   q.Priority,
		AssigneeID: q.AssigneeID,
		StartDate:  startDate,
		EndDate:    endDate,
		Keyword:    q.Keyword,
		Page:       q.Page,
		PageSize:   q.PageSize,
		Sort:       q.Sort,
	}
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	list, total, err := c.workOrderRepo.List(ctx, params, areaIDs)
	if err != nil {
		pkg.Error(ctx, "list work orders failed", zap.Error(err))
		return c.respErr(e, http.StatusInternalServerError, "查询工单列表失败")
	}
	return c.respOk(e, pageResult(list, total, q.Page, q.PageSize))
}

func (c *WorkOrderController) GetWorkOrder(e echo.Context) error {
	ctx := e.Request().Context()
	id, err := parseInt64(e.Param("id"))
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, "工单ID格式错误")
	}
	order, err := c.workOrderRepo.GetByID(ctx, id)
	if err != nil {
		return c.respErr(e, http.StatusNotFound, "工单不存在")
	}
	logs, _ := c.workOrderRepo.GetLogs(ctx, id)
	return c.respOk(e, map[string]interface{}{
		"order": order,
		"logs":  logs,
	})
}

func (c *WorkOrderController) CreateWorkOrder(e echo.Context) error {
	ctx := e.Request().Context()
	var req service.CreateWorkOrderRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	userID := middleware.GetUserID(ctx)
	order, err := c.workOrderSvc.CreateWorkOrder(ctx, userID, &req)
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, err.Error())
	}
	return c.respOk(e, order)
}

type transitionRequest struct {
	Status string `json:"status" validate:"required,workorder_status"`
	Remark string `json:"remark" validate:"max=512"`
}

func (c *WorkOrderController) TransitionStatus(e echo.Context) error {
	ctx := e.Request().Context()
	id, err := parseInt64(e.Param("id"))
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, "工单ID格式错误")
	}
	var req transitionRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	userID := middleware.GetUserID(ctx)
	order, err := c.workOrderSvc.TransitionStatus(ctx, id, req.Status, userID, req.Remark)
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, err.Error())
	}
	return c.respOk(e, order)
}

type assignRequest struct {
	AssigneeID int64 `json:"assignee_id" validate:"required,gt=0"`
}

func (c *WorkOrderController) AssignWorkOrder(e echo.Context) error {
	ctx := e.Request().Context()
	id, err := parseInt64(e.Param("id"))
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, "工单ID格式错误")
	}
	var req assignRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	userID := middleware.GetUserID(ctx)
	if err := c.workOrderSvc.AssignOrder(ctx, id, req.AssigneeID, userID); err != nil {
		return c.respErr(e, http.StatusBadRequest, err.Error())
	}
	return c.respOk(e, nil)
}

func (c *WorkOrderController) MyWorkOrders(e echo.Context) error {
	ctx := e.Request().Context()
	userID := middleware.GetUserID(ctx)
	status := e.QueryParam("status")
	page, _ := parseInt64(e.QueryParam("page"))
	pageSize, _ := parseInt64(e.QueryParam("page_size"))
	list, total, err := c.workOrderRepo.GetMyOrders(ctx, userID, status, int(page), int(pageSize))
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "查询我的工单失败")
	}
	return c.respOk(e, pageResult(list, total, int(page), int(pageSize)))
}

func (c *WorkOrderController) GetStatistics(e echo.Context) error {
	ctx := e.Request().Context()
	var startDate, endDate time.Time
	if s := e.QueryParam("start_date"); s != "" {
		startDate, _ = time.Parse("2006-01-02", s)
	}
	if s := e.QueryParam("end_date"); s != "" {
		endDate, _ = time.Parse("2006-01-02 15:04:05", s+" 23:59:59")
	}
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	stats, err := c.workOrderRepo.GetStatistics(ctx, areaIDs, startDate, endDate)
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "获取统计数据失败")
	}
	return c.respOk(e, stats)
}

func (c *WorkOrderController) respOk(e echo.Context, data interface{}) error {
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "success",
		Data:      data,
		RequestID: middleware.GetRequestID(e.Request().Context()),
		Timestamp: time.Now().Unix(),
	})
}

func (c *WorkOrderController) respErr(e echo.Context, code int, msg string) error {
	return e.JSON(code, model.Response{
		Code:      code,
		Message:   msg,
		RequestID: middleware.GetRequestID(e.Request().Context()),
		Timestamp: time.Now().Unix(),
	})
}
