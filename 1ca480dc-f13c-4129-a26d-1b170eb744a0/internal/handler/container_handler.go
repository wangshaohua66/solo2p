package handler

import (
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"port-ops-system/internal/model"
	"port-ops-system/internal/service"
	"port-ops-system/pkg/response"
)

type ContainerHandler struct {
	svc *service.ContainerService
}

func NewContainerHandler(svc *service.ContainerService) *ContainerHandler {
	return &ContainerHandler{svc: svc}
}

type CreateContainerRequest struct {
	ContainerNo   string                `json:"container_no" validate:"required"`
	ContainerType model.ContainerType   `json:"container_type" validate:"required"`
	Size          model.ContainerSize   `json:"size" validate:"required"`
	Weight        float64               `json:"weight"`
	WeightLevel   model.WeightLevel     `json:"weight_level"`
	ShippingLine  string                `json:"shipping_line"`
	Destination   string                `json:"destination"`
	VesselName    string                `json:"vessel_name"`
	VoyageNo      string                `json:"voyage_no"`
	Consignee     string                `json:"consignee"`
	Shipper       string                `json:"shipper"`
	FreeDays      int                   `json:"free_days"`
	EstimatedOut  *time.Time            `json:"estimated_out_time"`
}

type RecommendSlotRequest struct {
	ContainerID   int64               `json:"container_id" validate:"required"`
	ContainerType model.ContainerType `json:"container_type" validate:"required"`
	Size          model.ContainerSize `json:"size" validate:"required"`
	WeightLevel   model.WeightLevel   `json:"weight_level"`
	Destination   string              `json:"destination"`
	ShippingLine  string              `json:"shipping_line"`
}

type AssignSlotRequest struct {
	ContainerID int64  `json:"container_id" validate:"required"`
	SlotCode    string `json:"slot_code" validate:"required"`
}

func (h *ContainerHandler) Create(c echo.Context) error {
	var req CreateContainerRequest
	if err := c.Bind(&req); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	container := &model.Container{
		ContainerNo:     req.ContainerNo,
		ContainerType:   req.ContainerType,
		Size:            req.Size,
		Weight:          req.Weight,
		WeightLevel:     req.WeightLevel,
		ShippingLine:    req.ShippingLine,
		Destination:     req.Destination,
		VesselName:      req.VesselName,
		VoyageNo:        req.VoyageNo,
		Consignee:       req.Consignee,
		Shipper:         req.Shipper,
		FreeDays:        req.FreeDays,
		EstimatedOutTime: req.EstimatedOut,
	}

	if err := h.svc.CreateContainer(container); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, container)
}

func (h *ContainerHandler) Get(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid container id")
	}

	container, err := h.svc.GetContainer(id)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if container == nil {
		return response.Fail(c, response.CodeContainerNotFound, "container not found")
	}

	return response.Success(c, container)
}

func (h *ContainerHandler) GetByNo(c echo.Context) error {
	no := c.Param("no")
	if no == "" {
		return response.Fail(c, response.CodeBadRequest, "container no is required")
	}

	container, err := h.svc.GetContainerByNo(no)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if container == nil {
		return response.Fail(c, response.CodeContainerNotFound, "container not found")
	}

	return response.Success(c, container)
}

func (h *ContainerHandler) List(c echo.Context) error {
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
	if v := c.QueryParam("container_type"); v != "" {
		filters["container_type"] = v
	}
	if v := c.QueryParam("status"); v != "" {
		filters["status"] = v
	}
	if v := c.QueryParam("shipping_line"); v != "" {
		filters["shipping_line"] = v
	}
	if v := c.QueryParam("yard_id"); v != "" {
		filters["yard_id"] = v
	}

	list, total, err := h.svc.ListContainers(page, pageSize, filters)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.SuccessWithPage(c, list, total, page, pageSize)
}

func (h *ContainerHandler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid container id")
	}

	var container model.Container
	if err := c.Bind(&container); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}
	container.ID = id

	if err := h.svc.UpdateContainer(&container); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, container)
}

func (h *ContainerHandler) RecommendSlot(c echo.Context) error {
	var req RecommendSlotRequest
	if err := c.Bind(&req); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	container, err := h.svc.GetContainer(req.ContainerID)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if container == nil {
		return response.Fail(c, response.CodeContainerNotFound, "container not found")
	}

	slotReq := &service.SlotAllocationRequest{
		ContainerID:   req.ContainerID,
		ContainerNo:   container.ContainerNo,
		ContainerType: req.ContainerType,
		Size:          req.Size,
		WeightLevel:   req.WeightLevel,
		Destination:   req.Destination,
		ShippingLine:  req.ShippingLine,
	}

	rec, err := h.svc.RecommendSlot(slotReq)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, rec)
}

func (h *ContainerHandler) AssignSlot(c echo.Context) error {
	var req AssignSlotRequest
	if err := c.Bind(&req); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.AssignSlot(req.ContainerID, req.SlotCode); err != nil {
		return response.Fail(c, response.CodeSlotOccupied, err.Error())
	}

	return response.Success(c, map[string]interface{}{
		"container_id": req.ContainerID,
		"slot_code":    req.SlotCode,
	})
}

func (h *ContainerHandler) GetReshufflePlan(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid container id")
	}

	plans, err := h.svc.CalculateReshufflePlan(id)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, plans)
}

func (h *ContainerHandler) ListYards(c echo.Context) error {
	yards, err := h.svc.ListYards()
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, yards)
}

func (h *ContainerHandler) GetYard(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid yard id")
	}
	yard, err := h.svc.GetYard(id)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if yard == nil {
		return response.Fail(c, response.CodeNotFound, "yard not found")
	}
	return response.Success(c, yard)
}
