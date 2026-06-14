package handler

import (
	"craftbrew-tracker/internal/config"
	"craftbrew-tracker/internal/dto"
	"craftbrew-tracker/internal/middleware"
	"craftbrew-tracker/internal/model"
	"craftbrew-tracker/internal/service"
	"craftbrew-tracker/internal/util"
	"strconv"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	cfg       *config.Config
	svc       *service.Service
	Validator *validator.Validate
}

func New(cfg *config.Config, svc *service.Service) *Handler {
	return &Handler{cfg: cfg, svc: svc, Validator: validator.New()}
}

func (h *Handler) bindAndValidate(c echo.Context, v interface{}) error {
	if err := c.Bind(v); err != nil {
		return util.FailBadRequest(c, "invalid request body: "+err.Error())
	}
	if err := h.Validator.Struct(v); err != nil {
		if errs, ok := err.(validator.ValidationErrors); ok {
			details := make([]util.ErrorDetail, 0, len(errs))
			for _, e := range errs {
				details = append(details, util.ErrorDetail{
					Code:    "validation_error",
					Message: e.Tag() + " failed",
					Field:   e.Namespace(),
				})
			}
			return util.FailValidation(c, "validation failed", details...)
		}
		return util.FailValidation(c, err.Error())
	}
	return nil
}

// ---------- Auth ----------
// Login godoc
// @Summary 用户登录
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body dto.LoginRequest true "登录信息"
// @Success 200 {object} util.Response{data=dto.LoginResponse}
// @Router /api/v1/auth/login [post]
func (h *Handler) Login(c echo.Context) error {
	req := &dto.LoginRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	resp, err := h.svc.Login(req)
	if err != nil {
		if err == service.ErrInvalidCredentials {
			return util.FailUnauthorized(c, "用户名或密码错误")
		}
		return util.FailInternal(c, err.Error())
	}
	userObj := &model.User{
		ID: resp.User.ID, Username: resp.User.Username,
		RealName: resp.User.RealName, Role: resp.User.Role,
	}
	token, exp, terr := middleware.GenerateToken(&h.cfg.JWT, userObj)
	if terr != nil {
		return util.FailInternal(c, "生成令牌失败")
	}
	resp.Token = token
	resp.ExpiresAt = exp
	return util.Success(c, resp)
}

func (h *Handler) CreateUser(c echo.Context) error {
	req := &dto.CreateUserRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	id, err := h.svc.CreateUser(req)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Created(c, map[string]interface{}{"id": id})
}

func (h *Handler) Me(c echo.Context) error {
	u := middleware.GetAuth(c)
	if u == nil {
		return util.FailUnauthorized(c, "not authenticated")
	}
	return util.Success(c, &dto.UserInfo{
		ID: u.UserID, Username: u.Username, RealName: u.RealName, Role: u.Role, Email: "",
	})
}

func (h *Handler) ListUsers(c echo.Context) error {
	p := dto.PaginationParams{}
	_ = c.Bind(&p)
	page, size := p.Normalize()
	users, total, err := h.svc.Users.List(page, size)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Page(c, users, total, page, size)
}

func parseInt64(s string, def int64) int64 {
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return def
	}
	return v
}

func parseInt(s string, def int) int {
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}

func parseTimePtr(s string) *time.Time {
	if s == "" {
		return nil
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02", "2006-01-02 15:04:05"} {
		if t, err := time.ParseInLocation(layout, s, time.UTC); err == nil {
			return &t
		}
	}
	return nil
}
