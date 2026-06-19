package handler

import (
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"port-ops-system/internal/model"
	"port-ops-system/internal/service"
	"port-ops-system/pkg/response"
)

type ReeferHandler struct {
	svc *service.ReeferService
}

func NewReeferHandler(svc *service.ReeferService) *ReeferHandler {
	return &ReeferHandler{svc: svc}
}

type BatchTemperatureRequest struct {
	Readings []*model.TemperatureReading `json:"readings" validate:"required"`
}

type HandleWorkOrderRequest struct {
	HandlerName string `json:"handler_name" validate:"required"`
	HandleResult string `json:"handle_result" validate:"required"`
}

func (h *ReeferHandler) RegisterReefer(c echo.Context) error {
	var r model.ReeferContainer
	if err := c.Bind(&r); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.RegisterReefer(&r); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, r)
}

func (h *ReeferHandler) GetReeferByContainer(c echo.Context) error {
	containerID, err := strconv.ParseInt(c.Param("container_id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid container id")
	}

	r, err := h.svc.GetReeferByContainer(containerID)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if r == nil {
		return response.Fail(c, response.CodeNotFound, "reefer not found")
	}

	return response.Success(c, r)
}

func (h *ReeferHandler) ReportTemperature(c echo.Context) error {
	var reading model.TemperatureReading
	if err := c.Bind(&reading); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	alert, workOrder, err := h.svc.ReportTemperature(&reading)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	result := map[string]interface{}{
		"reading": reading,
	}
	if alert != nil {
		result["alert"] = alert
	}
	if workOrder != nil {
		result["work_order"] = workOrder
	}

	return response.Success(c, result)
}

func (h *ReeferHandler) BatchReportTemperature(c echo.Context) error {
	var req BatchTemperatureRequest
	if err := c.Bind(&req); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	alertCount, err := h.svc.BatchReport(req.Readings)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, map[string]interface{}{
		"total":       len(req.Readings),
		"alert_count": alertCount,
	})
}

func (h *ReeferHandler) ListActiveAlerts(c echo.Context) error {
	alerts, err := h.svc.ListActiveAlerts()
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, alerts)
}

func (h *ReeferHandler) ListWorkOrders(c echo.Context) error {
	status := model.AlertStatus(c.QueryParam("status"))

	orders, err := h.svc.ListWorkOrders(status)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, orders)
}

func (h *ReeferHandler) HandleWorkOrder(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid work order id")
	}

	var req HandleWorkOrderRequest
	if err := c.Bind(&req); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.HandleWorkOrder(id, req.HandlerName, req.HandleResult); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, map[string]interface{}{"id": id})
}

func (h *ReeferHandler) EscalateAlert(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid alert id")
	}

	if err := h.svc.EscalateAlert(id); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, map[string]interface{}{"id": id})
}

func (h *ReeferHandler) GetTemperatureHistory(c echo.Context) error {
	containerID, err := strconv.ParseInt(c.Param("container_id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid container id")
	}

	var startTime, endTime time.Time
	if startStr := c.QueryParam("start_time"); startStr != "" {
		startTime, err = time.Parse(time.RFC3339, startStr)
		if err != nil {
			return response.Fail(c, response.CodeBadRequest, "invalid start_time format, use RFC3339")
		}
	}
	if endStr := c.QueryParam("end_time"); endStr != "" {
		endTime, err = time.Parse(time.RFC3339, endStr)
		if err != nil {
			return response.Fail(c, response.CodeBadRequest, "invalid end_time format, use RFC3339")
		}
	}
	if startTime.IsZero() {
		startTime = time.Now().Add(-24 * time.Hour)
	}
	if endTime.IsZero() {
		endTime = time.Now()
	}

	history, err := h.svc.GetTemperatureHistory(containerID, startTime, endTime)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, history)
}

func (h *ReeferHandler) ListReefersWithAlert(c echo.Context) error {
	reefers, err := h.svc.ListReefersWithAlert()
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, reefers)
}
