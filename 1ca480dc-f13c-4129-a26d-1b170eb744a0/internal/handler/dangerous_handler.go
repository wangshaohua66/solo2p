package handler

import (
	"strconv"

	"github.com/labstack/echo/v4"
	"port-ops-system/internal/model"
	"port-ops-system/internal/service"
	"port-ops-system/pkg/response"
)

type DangerousHandler struct {
	svc *service.DangerousService
}

func NewDangerousHandler(svc *service.DangerousService) *DangerousHandler {
	return &DangerousHandler{svc: svc}
}

type UpdateDeclarationStatusRequest struct {
	Status          model.CustomsStatus `json:"status" validate:"required"`
	InspectionNotice string              `json:"inspection_notice"`
	Result          string              `json:"result"`
}

func (h *DangerousHandler) CreateDangerousGoods(c echo.Context) error {
	var d model.DangerousGoods
	if err := c.Bind(&d); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.CreateDangerousGoods(&d); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, d)
}

func (h *DangerousHandler) GetDangerousByContainer(c echo.Context) error {
	containerID, err := strconv.ParseInt(c.Param("container_id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid container id")
	}

	d, err := h.svc.GetDangerousByContainer(containerID)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if d == nil {
		return response.Fail(c, response.CodeNotFound, "dangerous goods not found")
	}

	return response.Success(c, d)
}

func (h *DangerousHandler) SubmitDeclaration(c echo.Context) error {
	var d model.CustomsDeclaration
	if err := c.Bind(&d); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.SubmitDeclaration(&d); err != nil {
		return response.Fail(c, response.CodeDangerousCustomsError, err.Error())
	}

	return response.Success(c, d)
}

func (h *DangerousHandler) GetDeclaration(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid declaration id")
	}

	d, err := h.svc.GetDeclaration(id)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if d == nil {
		return response.Fail(c, response.CodeNotFound, "declaration not found")
	}

	return response.Success(c, d)
}

func (h *DangerousHandler) ListDeclarations(c echo.Context) error {
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

	status := model.CustomsStatus(c.QueryParam("status"))

	list, total, err := h.svc.ListDeclarations(page, pageSize, status)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.SuccessWithPage(c, list, total, page, pageSize)
}

func (h *DangerousHandler) UpdateDeclarationStatus(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid declaration id")
	}

	var req UpdateDeclarationStatusRequest
	if err := c.Bind(&req); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.UpdateDeclarationStatus(id, req.Status, req.InspectionNotice, req.Result); err != nil {
		return response.Fail(c, response.CodeDangerousCustomsError, err.Error())
	}

	return response.Success(c, map[string]interface{}{"id": id})
}

func (h *DangerousHandler) CreateInspection(c echo.Context) error {
	var i model.InspectionRecord
	if err := c.Bind(&i); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.CreateInspection(&i); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, i)
}
