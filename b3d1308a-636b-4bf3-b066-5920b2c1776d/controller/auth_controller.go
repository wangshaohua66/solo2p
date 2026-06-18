package controller

import (
	"net/http"
	"strings"
	"time"

	"smart-lighting-api/middleware"
	"smart-lighting-api/model"
	"smart-lighting-api/pkg"
	"smart-lighting-api/repository"
	"smart-lighting-api/service"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

type AuthController struct {
	authService *service.AuthService
	userRepo    *repository.UserRepo
}

func NewAuthController(authService *service.AuthService, userRepo *repository.UserRepo) *AuthController {
	return &AuthController{
		authService: authService,
		userRepo:    userRepo,
	}
}

func (c *AuthController) Login(e echo.Context) error {
	ctx := e.Request().Context()
	var req service.LoginRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	result, err := c.authService.Login(ctx, &req)
	if err != nil {
		pkg.Warn(ctx, "login failed", zap.String("username", req.Username), zap.Error(err))
		return e.JSON(http.StatusUnauthorized, model.Response{
			Code:      401,
			Message:   err.Error(),
			RequestID: middleware.GetRequestID(ctx),
			Timestamp: time.Now().Unix(),
		})
	}
	pkg.Info(ctx, "login success", zap.String("username", req.Username))
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "登录成功",
		Data:      result,
		RequestID: middleware.GetRequestID(ctx),
		Timestamp: time.Now().Unix(),
	})
}

func (c *AuthController) Logout(e echo.Context) error {
	ctx := e.Request().Context()
	authHeader := e.Request().Header.Get("Authorization")
	tokenStr := ""
	if parts := strings.SplitN(authHeader, " ", 2); len(parts) == 2 {
		tokenStr = parts[1]
	}
	userID := middleware.GetUserID(ctx)
	if err := c.authService.Logout(ctx, tokenStr, userID); err != nil {
		return e.JSON(http.StatusInternalServerError, model.Response{
			Code:      500,
			Message:   "登出失败",
			RequestID: middleware.GetRequestID(ctx),
			Timestamp: time.Now().Unix(),
		})
	}
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "登出成功",
		RequestID: middleware.GetRequestID(ctx),
		Timestamp: time.Now().Unix(),
	})
}

func (c *AuthController) ChangePassword(e echo.Context) error {
	ctx := e.Request().Context()
	var req service.ChangePasswordRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	userID := middleware.GetUserID(ctx)
	if err := c.authService.ChangePassword(ctx, userID, &req); err != nil {
		return e.JSON(http.StatusBadRequest, model.Response{
			Code:      400,
			Message:   err.Error(),
			RequestID: middleware.GetRequestID(ctx),
			Timestamp: time.Now().Unix(),
		})
	}
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "密码修改成功",
		RequestID: middleware.GetRequestID(ctx),
		Timestamp: time.Now().Unix(),
	})
}

func (c *AuthController) GetProfile(e echo.Context) error {
	ctx := e.Request().Context()
	userID := middleware.GetUserID(ctx)
	user, err := c.authService.GetUserByID(ctx, userID)
	if err != nil {
		return e.JSON(http.StatusNotFound, model.Response{
			Code:      404,
			Message:   "用户不存在",
			RequestID: middleware.GetRequestID(ctx),
			Timestamp: time.Now().Unix(),
		})
	}
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "success",
		Data:      user,
		RequestID: middleware.GetRequestID(ctx),
		Timestamp: time.Now().Unix(),
	})
}

type listUserQuery struct {
	Role     string `query:"role"`
	AreaID   int64  `query:"area_id"`
	Status   *int   `query:"status"`
	Keyword  string `query:"keyword"`
	Page     int    `query:"page"`
	PageSize int    `query:"page_size"`
}

func (c *AuthController) ListUsers(e echo.Context) error {
	ctx := e.Request().Context()
	var q listUserQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	params := &repository.UserQueryParams{
		Role:     q.Role,
		AreaID:   q.AreaID,
		Status:   q.Status,
		Keyword:  q.Keyword,
		Page:     q.Page,
		PageSize: q.PageSize,
	}
	list, total, err := c.userRepo.List(ctx, params)
	if err != nil {
		return e.JSON(http.StatusInternalServerError, model.Response{
			Code:      500,
			Message:   "查询用户列表失败",
			RequestID: middleware.GetRequestID(ctx),
			Timestamp: time.Now().Unix(),
		})
	}
	return e.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "success",
		Data:    pageResult(list, total, q.Page, q.PageSize),
		RequestID: middleware.GetRequestID(ctx),
		Timestamp: time.Now().Unix(),
	})
}

type createUserRequest struct {
	Username string `json:"username" validate:"required,min=3,max=64"`
	Password string `json:"password" validate:"required,min=6,max=64"`
	RealName string `json:"real_name" validate:"max=64"`
	Role     string `json:"role" validate:"required,role"`
	AreaID   int64  `json:"area_id"`
	Phone    string `json:"phone" validate:"phone"`
	Email    string `json:"email" validate:"omitempty,email"`
	Status   *int   `json:"status"`
}

func (c *AuthController) CreateUser(e echo.Context) error {
	ctx := e.Request().Context()
	var req createUserRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	status := 1
	if req.Status != nil {
		status = *req.Status
	}
	user := &model.User{
		Username: req.Username,
		RealName: req.RealName,
		Role:     req.Role,
		AreaID:   req.AreaID,
		Phone:    req.Phone,
		Email:    req.Email,
		Status:   status,
	}
	created, err := c.authService.CreateUser(ctx, user, req.Password)
	if err != nil {
		return e.JSON(http.StatusBadRequest, model.Response{
			Code:      400,
			Message:   "创建用户失败: " + err.Error(),
			RequestID: middleware.GetRequestID(ctx),
			Timestamp: time.Now().Unix(),
		})
	}
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "创建成功",
		Data:      created,
		RequestID: middleware.GetRequestID(ctx),
		Timestamp: time.Now().Unix(),
	})
}

func (c *AuthController) UpdateUser(e echo.Context) error {
	ctx := e.Request().Context()
	id, err := parseInt64(e.Param("id"))
	if err != nil {
		return e.JSON(http.StatusBadRequest, model.Response{
			Code:      400,
			Message:   "用户ID格式错误",
			RequestID: middleware.GetRequestID(ctx),
			Timestamp: time.Now().Unix(),
		})
	}
	user, err := c.userRepo.GetByID(ctx, id)
	if err != nil {
		return e.JSON(http.StatusNotFound, model.Response{
			Code:      404,
			Message:   "用户不存在",
			RequestID: middleware.GetRequestID(ctx),
			Timestamp: time.Now().Unix(),
		})
	}
	type updateUserReq struct {
		RealName string `json:"real_name" validate:"max=64"`
		Role     string `json:"role" validate:"role"`
		AreaID   int64  `json:"area_id"`
		Phone    string `json:"phone" validate:"phone"`
		Email    string `json:"email" validate:"omitempty,email"`
		Status   *int   `json:"status"`
	}
	var req updateUserReq
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	if req.RealName != "" {
		user.RealName = req.RealName
	}
	if req.Role != "" {
		user.Role = req.Role
	}
	if req.AreaID > 0 {
		user.AreaID = req.AreaID
	}
	if req.Phone != "" {
		user.Phone = req.Phone
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Status != nil {
		user.Status = *req.Status
	}
	user.UpdatedAt = time.Now()
	if err := c.userRepo.Update(ctx, user); err != nil {
		return e.JSON(http.StatusInternalServerError, model.Response{
			Code:      500,
			Message:   "更新用户失败",
			RequestID: middleware.GetRequestID(ctx),
			Timestamp: time.Now().Unix(),
		})
	}
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "更新成功",
		Data:      user,
		RequestID: middleware.GetRequestID(ctx),
		Timestamp: time.Now().Unix(),
	})
}

type UserController struct {
	userRepo    *repository.UserRepo
	authService *service.AuthService
}

func NewUserController(userRepo *repository.UserRepo, authService *service.AuthService) *UserController {
	return &UserController{
		userRepo:    userRepo,
		authService: authService,
	}
}

func (c *UserController) GetUser(e echo.Context) error {
	ctx := e.Request().Context()
	id, err := parseInt64(e.Param("id"))
	if err != nil {
		return e.JSON(http.StatusBadRequest, model.Response{
			Code:      400,
			Message:   "用户ID格式错误",
			RequestID: middleware.GetRequestID(ctx),
			Timestamp: time.Now().Unix(),
		})
	}
	user, err := c.userRepo.GetByID(ctx, id)
	if err != nil {
		return e.JSON(http.StatusNotFound, model.Response{
			Code:      404,
			Message:   "用户不存在",
			RequestID: middleware.GetRequestID(ctx),
			Timestamp: time.Now().Unix(),
		})
	}
	info := &service.UserInfo{
		ID:       user.ID,
		Username: user.Username,
		RealName: user.RealName,
		Role:     user.Role,
		AreaID:   user.AreaID,
		Phone:    user.Phone,
		Email:    user.Email,
	}
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "success",
		Data:      info,
		RequestID: middleware.GetRequestID(ctx),
		Timestamp: time.Now().Unix(),
	})
}

func (c *UserController) ListOperators(e echo.Context) error {
	ctx := e.Request().Context()
	areaID, _ := parseInt64(e.QueryParam("area_id"))
	list, err := c.userRepo.ListOperatorsByArea(ctx, areaID)
	if err != nil {
		return e.JSON(http.StatusInternalServerError, model.Response{
			Code:      500,
			Message:   "查询运维人员列表失败",
			RequestID: middleware.GetRequestID(ctx),
			Timestamp: time.Now().Unix(),
		})
	}
	infos := make([]*service.UserInfo, 0, len(list))
	for _, u := range list {
		infos = append(infos, &service.UserInfo{
			ID:       u.ID,
			Username: u.Username,
			RealName: u.RealName,
			Role:     u.Role,
			AreaID:   u.AreaID,
			Phone:    u.Phone,
			Email:    u.Email,
		})
	}
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "success",
		Data:      infos,
		RequestID: middleware.GetRequestID(ctx),
		Timestamp: time.Now().Unix(),
	})
}
