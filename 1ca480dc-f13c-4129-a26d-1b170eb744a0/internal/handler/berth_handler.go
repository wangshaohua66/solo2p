package handler

import (
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"port-ops-system/internal/model"
	"port-ops-system/internal/service"
	"port-ops-system/pkg/response"
)

type BerthHandler struct {
	svc *service.BerthService
}

func NewBerthHandler(svc *service.BerthService) *BerthHandler {
	return &BerthHandler{svc: svc}
}

type GenerateScheduleRequest struct {
	VesselCallID   int64  `json:"vessel_call_id" validate:"required"`
	IsEmergency    bool   `json:"is_emergency"`
	PreferredBerth *int64 `json:"preferred_berth_id"`
}

type AdjustPlanRequest struct {
	StartTime *time.Time `json:"start_time"`
	EndTime   *time.Time `json:"end_time"`
}

func (h *BerthHandler) ListBerths(c echo.Context) error {
	berths, err := h.svc.ListBerths()
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, berths)
}

func (h *BerthHandler) GetBerth(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid berth id")
	}
	berth, err := h.svc.GetBerth(id)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if berth == nil {
		return response.Fail(c, response.CodeNotFound, "berth not found")
	}
	return response.Success(c, berth)
}

func (h *BerthHandler) ListCranes(c echo.Context) error {
	cranes, err := h.svc.ListCranes()
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, cranes)
}

func (h *BerthHandler) GetCrane(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid crane id")
	}
	crane, err := h.svc.GetCrane(id)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if crane == nil {
		return response.Fail(c, response.CodeNotFound, "crane not found")
	}
	return response.Success(c, crane)
}

func (h *BerthHandler) ListVesselCalls(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("page_size"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	filters := make(map[string]interface{})
	if v := c.QueryParam("status"); v != "" {
		filters["status"] = v
	}

	list, total, err := h.svc.ListVesselCalls(page, pageSize, filters)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.SuccessWithPage(c, list, total, page, pageSize)
}

func (h *BerthHandler) GetVesselCall(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid vessel call id")
	}
	vc, err := h.svc.GetVesselCall(id)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if vc == nil {
		return response.Fail(c, response.CodeNotFound, "vessel call not found")
	}
	return response.Success(c, vc)
}

func (h *BerthHandler) CreateVesselCall(c echo.Context) error {
	var vc model.VesselCall
	if err := c.Bind(&vc); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}
	if err := h.svc.CreateVesselCall(&vc); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, vc)
}

func (h *BerthHandler) GenerateSchedule(c echo.Context) error {
	var req GenerateScheduleRequest
	if err := c.Bind(&req); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	scheduleReq := &service.ScheduleRequest{
		VesselCallID:   req.VesselCallID,
		IsEmergency:    req.IsEmergency,
		PreferredBerth: req.PreferredBerth,
	}

	rec, err := h.svc.GenerateSchedule(scheduleReq)
	if err != nil {
		return response.Fail(c, response.CodeBerthConflict, err.Error())
	}
	return response.Success(c, rec)
}

func (h *BerthHandler) ConfirmPlan(c echo.Context) error {
	var plan model.BerthPlan
	if err := c.Bind(&plan); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}
	confirmed, err := h.svc.ConfirmPlan(&plan)
	if err != nil {
		return response.Fail(c, response.CodeBerthOccupied, err.Error())
	}
	return response.Success(c, confirmed)
}

func (h *BerthHandler) ListPlans(c echo.Context) error {
	dateStr := c.QueryParam("date")
	var date time.Time
	var err error
	if dateStr != "" {
		date, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			return response.Fail(c, response.CodeBadRequest, "invalid date format, use YYYY-MM-DD")
		}
	} else {
		date = time.Now()
	}

	plans, err := h.svc.ListPlansByDate(date)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, plans)
}

func (h *BerthHandler) AdjustPlan(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid plan id")
	}

	var req AdjustPlanRequest
	if err := c.Bind(&req); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.AdjustPlan(id, req.StartTime, req.EndTime); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, map[string]interface{}{"id": id})
}

func (h *BerthHandler) DeletePlan(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid plan id")
	}
	if err := h.svc.DeletePlan(id); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, map[string]interface{}{"id": id})
}
