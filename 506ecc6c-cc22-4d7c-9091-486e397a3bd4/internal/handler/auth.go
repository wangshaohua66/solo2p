package handler

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labelops/backend/internal/config"
	"github.com/labelops/backend/internal/middleware"
	"github.com/labelops/backend/internal/model"
	"github.com/labelops/backend/internal/store"
	"github.com/labelops/backend/internal/util"
)

type AuthHandler struct {
	repo  *store.MockRepo
	redis *store.RedisStore
	cfg   *config.JWTConfig
}

func NewAuthHandler(repo *store.MockRepo, redis *store.RedisStore, cfg *config.JWTConfig) *AuthHandler {
	return &AuthHandler{repo: repo, redis: redis, cfg: cfg}
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token     string     `json:"token"`
	ExpiresIn int        `json:"expires_in"`
	User      *model.User `json:"user"`
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Username == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "username is required")
	}

	user := h.repo.GetUserByUsername(req.Username)
	if user == nil {
		role := model.UserRole(req.Username)
		switch role {
		case model.RoleAdmin, model.RoleFinance, model.RoleCopyright, model.RoleUserProducer, model.RoleArtist:
			ids := h.repo.GetUserIDsByRole(role)
			if len(ids) > 0 {
				user = h.repo.GetUser(ids[0])
			}
		}
	}
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid credentials")
	}

	now := time.Now()
	user.LastLogin = &now

	token, err := middleware.GenerateToken(h.cfg, user)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "generate token failed")
	}

	_ = h.redis.Set(c.Request().Context(), "user:token:"+user.ID, token, time.Duration(h.cfg.ExpireHours)*time.Hour)

	return c.JSON(http.StatusOK, LoginResponse{
		Token:     token,
		ExpiresIn: h.cfg.ExpireHours * 3600,
		User:      user,
	})
}

func (h *AuthHandler) Me(c echo.Context) error {
	claims := middleware.GetUserFromContext(c)
	if claims == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthenticated")
	}
	user := h.repo.GetUser(claims.UserID)
	if user == nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}
	return c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) Logout(c echo.Context) error {
	claims := middleware.GetUserFromContext(c)
	if claims != nil {
		_ = h.redis.Delete(c.Request().Context(), "user:token:"+claims.UserID)
	}
	return c.NoContent(http.StatusNoContent)
}

type AuditLogRequest struct {
	UserID   string `query:"user_id"`
	Action   string `query:"action"`
	Resource string `query:"resource"`
	Page     int    `query:"page"`
	PageSize int    `query:"page_size"`
}

func (h *AuthHandler) ListAuditLogs(c echo.Context) error {
	req := AuditLogRequest{Page: 1, PageSize: 20}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid parameters")
	}
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 || req.PageSize > 200 {
		req.PageSize = 20
	}

	user := ""
	if req.UserID != "" {
		u := h.repo.GetUser(req.UserID)
		if u != nil {
			user = u.Username
		}
	}

	logs, total := h.repo.ListAuditLogs(req.Page, req.PageSize, user, req.Action)
	return c.JSON(http.StatusOK, PagedResponse{
		Total:    int64(total),
		Page:     req.Page,
		PageSize: req.PageSize,
		Data:     logs,
	})
}

func (h *AuthHandler) ListUsers(c echo.Context) error {
	role := model.UserRole(c.QueryParam("role"))
	page, _ := 1, 1
	pageSize, _ := 50, 50
	_ = page
	users, total := h.repo.ListUsers(role, 0, pageSize)
	return c.JSON(http.StatusOK, PagedResponse{
		Total:    total,
		Page:     1,
		PageSize: pageSize,
		Data:     users,
	})
}

func (h *AuthHandler) ValidateToken(c echo.Context) error {
	claims := middleware.GetUserFromContext(c)
	if claims == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"valid":      true,
		"user_id":    claims.UserID,
		"username":   claims.Username,
		"role":       claims.Role,
		"artist_id":  claims.ArtistID,
		"permissions": buildPermissions(claims.Role),
	})
}

func buildPermissions(role model.UserRole) map[string][]string {
	base := map[string][]string{
		"work":       {"read"},
		"dashboard":  {"read"},
	}

	switch role {
	case model.RoleAdmin:
		base["work"] = []string{"read", "create", "update", "delete"}
		base["copyright"] = []string{"read", "create", "update", "delete"}
		base["royalty"] = []string{"read", "create", "update", "approve", "pay"}
		base["monitor"] = []string{"read", "scan", "resolve"}
		base["user"] = []string{"read", "create", "update", "delete"}
		base["dashboard"] = []string{"read", "export"}
		base["audit"] = []string{"read"}

	case model.RoleFinance:
		base["work"] = []string{"read"}
		base["royalty"] = []string{"read", "create", "update", "approve", "pay"}
		base["dashboard"] = []string{"read", "export"}

	case model.RoleCopyright:
		base["work"] = []string{"read", "create", "update"}
		base["copyright"] = []string{"read", "create", "update"}
		base["monitor"] = []string{"read", "scan", "resolve"}
		base["royalty"] = []string{"read"}

	case model.RoleUserProducer:
		base["work"] = []string{"read", "create", "update"}
		base["monitor"] = []string{"read"}

	case model.RoleArtist:
		base["work"] = []string{"read"}
		base["royalty"] = []string{"read"}
	}

	return base
}

var _ = util.NewID
