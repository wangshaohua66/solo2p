package handler

import (
	"strconv"

	"github.com/labstack/echo/v4"
	"port-ops-system/internal/model"
	"port-ops-system/internal/service"
	"port-ops-system/pkg/response"
)

type BillingHandler struct {
	svc *service.BillingService
}

func NewBillingHandler(svc *service.BillingService) *BillingHandler {
	return &BillingHandler{svc: svc}
}

func (h *BillingHandler) CalculateStorageFee(c echo.Context) error {
	containerID, err := strconv.ParseInt(c.Param("container_id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid container id")
	}

	bill, err := h.svc.CalculateStorageFee(containerID)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, bill)
}

func (h *BillingHandler) CreateBill(c echo.Context) error {
	var bill model.StorageBill
	if err := c.Bind(&bill); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.CreateBill(&bill); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, bill)
}

func (h *BillingHandler) GetBill(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid bill id")
	}

	bill, err := h.svc.GetBill(id)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if bill == nil {
		return response.Fail(c, response.CodeNotFound, "bill not found")
	}

	return response.Success(c, bill)
}

func (h *BillingHandler) ListBills(c echo.Context) error {
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
	if v := c.QueryParam("customer_name"); v != "" {
		filters["customer_name"] = v
	}
	if v := c.QueryParam("billing_period"); v != "" {
		filters["billing_period"] = v
	}

	list, total, err := h.svc.ListBills(page, pageSize, filters)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.SuccessWithPage(c, list, total, page, pageSize)
}

func (h *BillingHandler) CreateRate(c echo.Context) error {
	var rate model.StorageRate
	if err := c.Bind(&rate); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.CreateRate(&rate); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, rate)
}

func (h *BillingHandler) ListRates(c echo.Context) error {
	rates, err := h.svc.ListRates()
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, rates)
}

func (h *BillingHandler) CreateInvoice(c echo.Context) error {
	var invoice model.Invoice
	if err := c.Bind(&invoice); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.CreateInvoice(&invoice); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, invoice)
}

func (h *BillingHandler) GetInvoice(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid invoice id")
	}

	invoice, err := h.svc.GetInvoice(id)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	if invoice == nil {
		return response.Fail(c, response.CodeBillingInvoiceNotFound, "invoice not found")
	}

	return response.Success(c, invoice)
}

func (h *BillingHandler) ListInvoices(c echo.Context) error {
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

	status := model.BillingStatus(c.QueryParam("status"))

	list, total, err := h.svc.ListInvoices(page, pageSize, status)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.SuccessWithPage(c, list, total, page, pageSize)
}

func (h *BillingHandler) RecordPayment(c echo.Context) error {
	var payment model.Payment
	if err := c.Bind(&payment); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if err := h.svc.RecordPayment(&payment); err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}

	return response.Success(c, payment)
}
