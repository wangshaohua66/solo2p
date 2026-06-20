package handler

import (
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"

	cfgpkg "github.com/labelops/backend/internal/config"
	mw "github.com/labelops/backend/internal/middleware"
	"github.com/labelops/backend/internal/model"
	ws "github.com/labelops/backend/internal/ws"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		if strings.Contains(origin, "localhost") {
			return true
		}
		if strings.Contains(origin, "127.0.0.1") {
			return true
		}
		return true
	},
}

type WSHandler struct {
	hub *ws.Hub
	cfg *cfgpkg.JWTConfig
}

func NewWSHandler(hub *ws.Hub, cfg *cfgpkg.JWTConfig) *WSHandler {
	return &WSHandler{hub: hub, cfg: cfg}
}

func (h *WSHandler) HandleWebSocket(c echo.Context) error {
	tokenStr := c.QueryParam("token")
	if tokenStr == "" {
		authHeader := c.Request().Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	if tokenStr == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing token"})
	}

	claims, err := mw.ValidateToken(tokenStr, h.cfg)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token"})
	}

	conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}

	roles := make([]string, 0, 1)
	roles = append(roles, string(claims.Role))

	client := ws.NewClient(conn, claims.UserID, roles)

	h.hub.Register(client)

	go client.WritePump()
	go client.ReadPump(h.hub)

	return nil
}

func (h *WSHandler) NotifyPiracy(p *model.PiracyRecord, work *model.Work) error {
	payload := ws.PiracyAlertPayload{
		PiracyID:    p.ID,
		WorkID:      p.WorkID,
		WorkTitle:   work.Title,
		MatchScore:  p.MatchScore,
		SuspectURL:  p.SuspectURL,
		SuspectName: p.SuspectTitle,
		Platform:    p.SuspectPlatform,
	}
	return h.hub.SendToRoles(
		[]string{string(model.RoleAdmin), string(model.RoleCopyright)},
		ws.MsgTypePiracyAlert,
		payload,
	)
}

func (h *WSHandler) NotifyCrawlProgress(p *ws.CrawlProgressPayload) error {
	return h.hub.SendToRoles(
		[]string{string(model.RoleAdmin), string(model.RoleFinance), string(model.RoleCopyright)},
		ws.MsgTypeCrawlProgress,
		p,
	)
}

func (h *WSHandler) NotifyAlert(level, title, message string) error {
	payload := ws.AlertPayload{
		Level:   level,
		Title:   title,
		Message: message,
	}
	return h.hub.SendToRoles(
		[]string{string(model.RoleAdmin)},
		ws.MsgTypeAlert,
		payload,
	)
}
