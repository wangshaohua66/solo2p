package handler

import (
	"strconv"

	"github.com/labstack/echo/v4"
	"port-ops-system/internal/model"
	"port-ops-system/internal/service"
	"port-ops-system/pkg/response"
)

type AppointmentHandler struct {
	svc *service.AppointmentService
}

func NewAppointmentHandler(svc *service.AppointmentService) *AppointmentHandler {
	return &AppointmentHandler{svc: svc}
}

type VerifyRequest struct {
	AppointmentNo string `json:"appointment_no" validate:"required"`
	TruckPlateNo  string `json:"truck_plate_no" validate:"required"`
}

type BlacklistRequest struct {
	EntityType  string `json:"entity_type" validate:"required"`
	EntityValue string `json:"entity_value" validate:"required"`
	Reason      string `json:"reason"`
}

func (h *AppointmentHandler) Create(c echo.Context) error {
	var a model.TruckAppointment
	if err := c.Bind(&a); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.CreateAppointment(&a); err != nil {
		if err.Error() == "车辆在黑名单中，禁止预约" || err.Error() == "企业在黑名单中，禁止预约" {
			return response.Fail(c, response.CodeAppointmentBlacklist, err.Error())
		}
		if err.Error() == "该时段预约已满" {
			return response.Fail(c, response.CodeAppointmentFull, err.Error())
		}
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, a)
}

func (h *AppointmentHandler) Get(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid appointment id")
	}

	a, err := h.svc.GetAppointment(id)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if a == nil {
		return response.Fail(c, response.CodeNotFound, "appointment not found")
	}

	return response.Success(c, a)
}

func (h *AppointmentHandler) GetByNo(c echo.Context) error {
	no := c.Param("no")
	if no == "" {
		return response.Fail(c, response.CodeBadRequest, "appointment no is required")
	}

	a, err := h.svc.GetAppointmentByNo(no)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if a == nil {
		return response.Fail(c, response.CodeNotFound, "appointment not found")
	}

	return response.Success(c, a)
}

func (h *AppointmentHandler) List(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("page_size"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	filters := make(map[string]interface{})
	if v := c.QueryParam("status"); v != "" {
		filters["status"] = v
	}
	if v := c.QueryParam("truck_plate_no"); v != "" {
		filters["truck_plate_no"] = v
	}
	if v := c.QueryParam("gate_id"); v != "" {
		filters["gate_id"] = v
	}

	list, total, err := h.svc.ListAppointments(page, pageSize, filters)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.SuccessWithPage(c, list, total, page, pageSize)
}

func (h *AppointmentHandler) CheckIn(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid appointment id")
	}

	if err := h.svc.CheckIn(id); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, map[string]interface{}{"id": id})
}

func (h *AppointmentHandler) CheckOut(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid appointment id")
	}

	if err := h.svc.CheckOut(id); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, map[string]interface{}{"id": id})
}

func (h *AppointmentHandler) Cancel(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid appointment id")
	}

	if err := h.svc.Cancel(id); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, map[string]interface{}{"id": id})
}

func (h *AppointmentHandler) Verify(c echo.Context) error {
	var req VerifyRequest
	if err := c.Bind(&req); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	a, err := h.svc.Verify(req.AppointmentNo, req.TruckPlateNo)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, err.Error())
	}

	return response.Success(c, a)
}

func (h *AppointmentHandler) ListGates(c echo.Context) error {
	gates, err := h.svc.ListGates()
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, gates)
}

func (h *AppointmentHandler) AddBlacklist(c echo.Context) error {
	var req BlacklistRequest
	if err := c.Bind(&req); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	b := &model.Blacklist{
		EntityType:  req.EntityType,
		EntityValue: req.EntityValue,
		Reason:      req.Reason,
	}

	if err := h.svc.AddToBlacklist(b); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, b)
}
