package handler

import (
	"errors"
	"net/http"
	"strconv"

	"equipment-booking/internal/middleware"
	"equipment-booking/internal/model"
	"equipment-booking/internal/service"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type NotificationHandler struct {
	notificationService service.NotificationService
}

func NewNotificationHandler(notificationService service.NotificationService) *NotificationHandler {
	return &NotificationHandler{
		notificationService: notificationService,
	}
}

func (h *NotificationHandler) RegisterRoutes(g *echo.Group) {
	notification := g.Group("/notification", middleware.JWTAuth("your-secret-key"), middleware.RBAC("notification:read"))
	{
		notification.GET("", h.GetNotificationList)
		notification.GET("/unread-count", h.GetUnreadCount)
		notification.PATCH("/:id/read", h.MarkAsRead, middleware.RBAC("notification:update"))
		notification.PATCH("/read-all", h.MarkAllAsRead, middleware.RBAC("notification:update"))
	}
}

type GetNotificationListRequest struct {
	IsRead     *bool `form:"is_read"`
	model.PaginationParams
}

func (h *NotificationHandler) GetNotificationList(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return middleware.ErrUserNotFound
	}

	var req GetNotificationListRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "参数错误")
	}

	result, err := h.notificationService.GetNotificationList(c.Request().Context(), user.UserID, req.IsRead, &req.PaginationParams)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "获取通知列表失败")
	}

	return c.JSON(http.StatusOK, result)
}

func (h *NotificationHandler) GetUnreadCount(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return middleware.ErrUserNotFound
	}

	stats, err := h.notificationService.CountUnread(c.Request().Context(), user.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "获取未读数量失败")
	}

	return c.JSON(http.StatusOK, stats)
}

func (h *NotificationHandler) MarkAsRead(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return middleware.ErrUserNotFound
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "无效的通知ID")
	}

	err = h.notificationService.MarkAsRead(c.Request().Context(), user.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return echo.NewHTTPError(http.StatusNotFound, "通知不存在")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "标记已读失败")
	}

	return c.JSON(http.StatusOK, echo.Map{"message": "标记成功"})
}

func (h *NotificationHandler) MarkAllAsRead(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return middleware.ErrUserNotFound
	}

	err := h.notificationService.MarkAllAsRead(c.Request().Context(), user.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "全部标记已读失败")
	}

	return c.JSON(http.StatusOK, echo.Map{"message": "全部标记成功"})
}
