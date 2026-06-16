package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"equipment-booking/internal/middleware"
	"equipment-booking/internal/model"
	"equipment-booking/internal/repository"
	"equipment-booking/internal/service"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserHandler struct {
	db              *gorm.DB
	userRepo        repository.UserRepository
	roleRepo        repository.RoleRepository
	centerRepo      repository.CenterRepository
	auditLogService service.AuditLogService
}

func NewUserHandler(
	db *gorm.DB,
	userRepo repository.UserRepository,
	roleRepo repository.RoleRepository,
	centerRepo repository.CenterRepository,
	auditLogService service.AuditLogService,
) *UserHandler {
	return &UserHandler{
		db:              db,
		userRepo:        userRepo,
		roleRepo:        roleRepo,
		centerRepo:      centerRepo,
		auditLogService: auditLogService,
	}
}

type CreateUserRequest struct {
	Username      string  `json:"username"`
	Name          string  `json:"name"`
	Email         string  `json:"email"`
	RoleID        uint64  `json:"role_id"`
	CenterID      uint64  `json:"center_id"`
	Password      string  `json:"password"`
	InitialBudget float64 `json:"initial_budget"`
	AdvisorID     *uint64 `json:"advisor_id"`
}

type UpdateUserRequest struct {
	Name      *string  `json:"name"`
	Email     *string  `json:"email"`
	RoleID    *uint64  `json:"role_id"`
	CenterID  *uint64  `json:"center_id"`
	Password  *string  `json:"password"`
	Budget    *float64 `json:"budget"`
	AdvisorID *uint64  `json:"advisor_id"`
}

type UpdateRoleRequest struct {
	RoleID uint64 `json:"role_id"`
}

func hashPassword(password string) (string, error) {
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedBytes), nil
}

func parseUint64Param(c echo.Context, name string) (uint64, error) {
	idStr := c.Param(name)
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return 0, errors.New("无效的ID格式")
	}
	return id, nil
}

// GetUserList 获取用户列表
// @Summary 获取用户列表
// @Description 分页获取用户列表，支持按角色、中心、关键词筛选（仅超管可访问）
// @Tags 用户管理
// @Accept json
// @Produce json
// @Param role_id query string false "角色ID"
// @Param center_id query string false "中心ID"
// @Param keyword query string false "搜索关键词（用户名/姓名/邮箱）"
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页数量" default(10)
// @Success 200 {object} Response{data=PaginatedData{items=[]model.User}} "成功"
// @Failure 401 {object} Response "未授权"
// @Failure 403 {object} Response "权限不足"
// @Router /api/user [get]
// @Security BearerAuth
func (h *UserHandler) GetUserList(c echo.Context) error {
	ctx := c.Request().Context()

	if !middleware.HasRole(ctx, middleware.RoleSuperAdmin) {
		return errorResponse(c, http.StatusForbidden, "仅超管可访问")
	}

	var roleID, centerID *uint64
	if c.QueryParam("role_id") != "" {
		if id, err := strconv.ParseUint(c.QueryParam("role_id"), 10, 64); err == nil && id > 0 {
			roleID = &id
		}
	}
	if c.QueryParam("center_id") != "" {
		if id, err := strconv.ParseUint(c.QueryParam("center_id"), 10, 64); err == nil && id > 0 {
			centerID = &id
		}
	}

	var keyword *string
	if kw := strings.TrimSpace(c.QueryParam("keyword")); kw != "" {
		keyword = &kw
	}

	pagination := &model.PaginationParams{
		Page:     1,
		PageSize: 10,
	}
	if pageStr := c.QueryParam("page"); pageStr != "" {
		if page, err := strconv.Atoi(pageStr); err == nil && page > 0 {
			pagination.Page = page
		}
	}
	if pageSizeStr := c.QueryParam("page_size"); pageSizeStr != "" {
		if pageSize, err := strconv.Atoi(pageSizeStr); err == nil && pageSize > 0 {
			pagination.PageSize = pageSize
		}
	}

	var users []model.User
	var total int64

	dbQuery := h.db.WithContext(ctx).
		Model(&model.User{}).
		Preload("Role").
		Preload("Center").
		Preload("Advisor")

	if roleID != nil {
		dbQuery = dbQuery.Where("role_id = ?", *roleID)
	}
	if centerID != nil {
		dbQuery = dbQuery.Where("center_id = ?", *centerID)
	}
	if keyword != nil {
		kw := "%" + *keyword + "%"
		dbQuery = dbQuery.Where("username LIKE ? OR name LIKE ? OR email LIKE ?", kw, kw, kw)
	}

	if err := dbQuery.Count(&total).Error; err != nil {
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	dbQuery = dbQuery.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())

	if err := dbQuery.Order("created_at DESC").Find(&users).Error; err != nil {
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	return successResponse(c, PaginatedData{
		Items:    users,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	})
}

// GetUserDetail 获取用户详情
// @Summary 获取用户详情
// @Description 根据ID获取用户详细信息（仅超管可访问）
// @Tags 用户管理
// @Accept json
// @Produce json
// @Param id path int true "用户ID"
// @Success 200 {object} Response{data=model.User} "成功"
// @Failure 401 {object} Response "未授权"
// @Failure 403 {object} Response "权限不足"
// @Failure 404 {object} Response "用户不存在"
// @Router /api/user/{id} [get]
// @Security BearerAuth
func (h *UserHandler) GetUserDetail(c echo.Context) error {
	ctx := c.Request().Context()

	if !middleware.HasRole(ctx, middleware.RoleSuperAdmin) {
		return errorResponse(c, http.StatusForbidden, "仅超管可访问")
	}

	id, err := parseUint64Param(c, "id")
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, err.Error())
	}

	user, err := h.userRepo.GetByIDWithDetails(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errorResponse(c, http.StatusNotFound, "用户不存在")
		}
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	return successResponse(c, user)
}

// CreateUser 创建用户
// @Summary 创建用户
// @Description 创建新用户（仅超管可访问）
// @Tags 用户管理
// @Accept json
// @Produce json
// @Param user body CreateUserRequest true "用户信息"
// @Success 201 {object} Response{data=model.User} "创建成功"
// @Failure 400 {object} Response "参数错误"
// @Failure 401 {object} Response "未授权"
// @Failure 403 {object} Response "权限不足"
// @Router /api/user [post]
// @Security BearerAuth
func (h *UserHandler) CreateUser(c echo.Context) error {
	ctx := c.Request().Context()

	user, ok := middleware.GetUser(ctx)
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	if !middleware.HasRole(ctx, middleware.RoleSuperAdmin) {
		return errorResponse(c, http.StatusForbidden, "仅超管可访问")
	}

	var req CreateUserRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
	}

	if req.Username == "" {
		return errorResponse(c, http.StatusBadRequest, "用户名不能为空")
	}
	if req.Name == "" {
		return errorResponse(c, http.StatusBadRequest, "姓名不能为空")
	}
	if req.RoleID == 0 {
		return errorResponse(c, http.StatusBadRequest, "角色ID不能为空")
	}
	if req.CenterID == 0 {
		return errorResponse(c, http.StatusBadRequest, "中心ID不能为空")
	}
	if req.Password == "" {
		return errorResponse(c, http.StatusBadRequest, "密码不能为空")
	}
	if len(req.Password) < 6 {
		return errorResponse(c, http.StatusBadRequest, "密码长度至少6位")
	}

	existing, err := h.userRepo.GetByUsername(ctx, req.Username)
	if err == nil && existing != nil {
		return errorResponse(c, http.StatusBadRequest, "用户名已存在")
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	if req.Email != "" {
		existing, err = h.userRepo.GetByEmail(ctx, req.Email)
		if err == nil && existing != nil {
			return errorResponse(c, http.StatusBadRequest, "邮箱已存在")
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return errorResponse(c, http.StatusInternalServerError, "查询失败")
		}
	}

	role, err := h.roleRepo.GetByID(ctx, req.RoleID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errorResponse(c, http.StatusBadRequest, "角色不存在")
		}
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	if role.Name == string(middleware.RoleStudent) && req.AdvisorID == nil {
		return errorResponse(c, http.StatusBadRequest, "学生用户必须关联导师ID")
	}

	if req.AdvisorID != nil {
		_, err := h.userRepo.GetByID(ctx, *req.AdvisorID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errorResponse(c, http.StatusBadRequest, "导师不存在")
			}
			return errorResponse(c, http.StatusInternalServerError, "查询失败")
		}
	}

	passwordHash, err := hashPassword(req.Password)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, "密码加密失败")
	}

	newUser := &model.User{
		Username:     req.Username,
		PasswordHash: passwordHash,
		Name:         req.Name,
		Email:        req.Email,
		RoleID:       req.RoleID,
		CenterID:     req.CenterID,
		Budget:       req.InitialBudget,
		AdvisorID:    req.AdvisorID,
	}

	if err := h.userRepo.Create(ctx, newUser); err != nil {
		return errorResponse(c, http.StatusInternalServerError, "创建失败")
	}

	ipAddress := getClientIP(c)
	var userIDPtr *uint64
	if user != nil {
		userIDPtr = &user.UserID
	}
	newUser.PasswordHash = ""

	_ = h.auditLogService.LogCreate(
		ctx,
		"users",
		newUser.ID,
		newUser,
		userIDPtr,
		ipAddress,
	)

	return c.JSON(http.StatusCreated, Response{
		Code:    0,
		Message: "success",
		Data:    newUser,
	})
}

// UpdateUser 更新用户信息
// @Summary 更新用户信息
// @Description 更新用户信息（仅超管可访问）
// @Tags 用户管理
// @Accept json
// @Produce json
// @Param id path int true "用户ID"
// @Param user body UpdateUserRequest true "用户信息"
// @Success 200 {object} Response{data=model.User} "更新成功"
// @Failure 400 {object} Response "参数错误"
// @Failure 401 {object} Response "未授权"
// @Failure 403 {object} Response "权限不足"
// @Failure 404 {object} Response "用户不存在"
// @Router /api/user/{id} [put]
// @Security BearerAuth
func (h *UserHandler) UpdateUser(c echo.Context) error {
	ctx := c.Request().Context()

	currentUser, ok := middleware.GetUser(ctx)
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	if !middleware.HasRole(ctx, middleware.RoleSuperAdmin) {
		return errorResponse(c, http.StatusForbidden, "仅超管可访问")
	}

	id, err := parseUint64Param(c, "id")
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, err.Error())
	}

	var req UpdateUserRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
	}

	user, err := h.userRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errorResponse(c, http.StatusNotFound, "用户不存在")
		}
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	oldUser := *user

	if req.Name != nil {
		user.Name = *req.Name
	}
	if req.Email != nil {
		user.Email = *req.Email
	}
	if req.RoleID != nil {
		role, err := h.roleRepo.GetByID(ctx, *req.RoleID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errorResponse(c, http.StatusBadRequest, "角色不存在")
			}
			return errorResponse(c, http.StatusInternalServerError, "查询失败")
		}
		if role.Name == string(middleware.RoleStudent) && req.AdvisorID == nil && user.AdvisorID == nil {
			return errorResponse(c, http.StatusBadRequest, "学生用户必须关联导师ID")
		}
		user.RoleID = *req.RoleID
	}
	if req.CenterID != nil {
		user.CenterID = *req.CenterID
	}
	if req.Password != nil {
		if len(*req.Password) < 6 {
			return errorResponse(c, http.StatusBadRequest, "密码长度至少6位")
		}
		passwordHash, err := hashPassword(*req.Password)
		if err != nil {
			return errorResponse(c, http.StatusInternalServerError, "密码加密失败")
		}
		user.PasswordHash = passwordHash
	}
	if req.Budget != nil {
		user.Budget = *req.Budget
	}
	if req.AdvisorID != nil {
		if *req.AdvisorID > 0 {
			_, err := h.userRepo.GetByID(ctx, *req.AdvisorID)
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errorResponse(c, http.StatusBadRequest, "导师不存在")
				}
				return errorResponse(c, http.StatusInternalServerError, "查询失败")
			}
		}
		user.AdvisorID = req.AdvisorID
	}

	if err := h.userRepo.Update(ctx, user); err != nil {
		return errorResponse(c, http.StatusInternalServerError, "更新失败")
	}

	ipAddress := getClientIP(c)
	var userIDPtr *uint64
	if currentUser != nil {
		userIDPtr = &currentUser.UserID
	}

	user.PasswordHash = ""
	oldUser.PasswordHash = ""

	_ = h.auditLogService.LogUpdate(
		ctx,
		"users",
		user.ID,
		oldUser,
		user,
		userIDPtr,
		ipAddress,
	)

	return successResponse(c, user)
}

// DeleteUser 删除用户
// @Summary 删除用户
// @Description 删除用户（仅超管可访问）
// @Tags 用户管理
// @Accept json
// @Produce json
// @Param id path int true "用户ID"
// @Success 200 {object} Response "删除成功"
// @Failure 401 {object} Response "未授权"
// @Failure 403 {object} Response "权限不足"
// @Failure 404 {object} Response "用户不存在"
// @Router /api/user/{id} [delete]
// @Security BearerAuth
func (h *UserHandler) DeleteUser(c echo.Context) error {
	ctx := c.Request().Context()

	currentUser, ok := middleware.GetUser(ctx)
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	if !middleware.HasRole(ctx, middleware.RoleSuperAdmin) {
		return errorResponse(c, http.StatusForbidden, "仅超管可访问")
	}

	id, err := parseUint64Param(c, "id")
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, err.Error())
	}

	user, err := h.userRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errorResponse(c, http.StatusNotFound, "用户不存在")
		}
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	oldUser := *user

	if err := h.userRepo.Delete(ctx, id); err != nil {
		return errorResponse(c, http.StatusInternalServerError, "删除失败")
	}

	ipAddress := getClientIP(c)
	var userIDPtr *uint64
	if currentUser != nil {
		userIDPtr = &currentUser.UserID
	}

	oldUser.PasswordHash = ""

	_ = h.auditLogService.LogDelete(
		ctx,
		"users",
		id,
		oldUser,
		userIDPtr,
		ipAddress,
	)

	return successResponse(c, map[string]string{"message": "删除成功"})
}

// UpdateUserRole 分配用户角色
// @Summary 分配用户角色
// @Description 更新用户角色（仅超管可访问）
// @Tags 用户管理
// @Accept json
// @Produce json
// @Param id path int true "用户ID"
// @Param role body UpdateRoleRequest true "角色信息"
// @Success 200 {object} Response{data=model.User} "更新成功"
// @Failure 400 {object} Response "参数错误"
// @Failure 401 {object} Response "未授权"
// @Failure 403 {object} Response "权限不足"
// @Failure 404 {object} Response "用户不存在"
// @Router /api/user/{id}/role [patch]
// @Security BearerAuth
func (h *UserHandler) UpdateUserRole(c echo.Context) error {
	ctx := c.Request().Context()

	currentUser, ok := middleware.GetUser(ctx)
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	if !middleware.HasRole(ctx, middleware.RoleSuperAdmin) {
		return errorResponse(c, http.StatusForbidden, "仅超管可访问")
	}

	id, err := parseUint64Param(c, "id")
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, err.Error())
	}

	var req UpdateRoleRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
	}

	if req.RoleID == 0 {
		return errorResponse(c, http.StatusBadRequest, "角色ID不能为空")
	}

	user, err := h.userRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errorResponse(c, http.StatusNotFound, "用户不存在")
		}
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	oldUser := *user

	role, err := h.roleRepo.GetByID(ctx, req.RoleID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errorResponse(c, http.StatusBadRequest, "角色不存在")
		}
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	if role.Name == string(middleware.RoleStudent) && user.AdvisorID == nil {
		return errorResponse(c, http.StatusBadRequest, "学生用户必须关联导师ID")
	}

	user.RoleID = req.RoleID

	if err := h.userRepo.Update(ctx, user); err != nil {
		return errorResponse(c, http.StatusInternalServerError, "更新失败")
	}

	ipAddress := getClientIP(c)
	var userIDPtr *uint64
	if currentUser != nil {
		userIDPtr = &currentUser.UserID
	}

	user.PasswordHash = ""
	oldUser.PasswordHash = ""

	_ = h.auditLogService.LogAction(
		ctx,
		"update_role",
		"users",
		&id,
		oldUser,
		user,
		userIDPtr,
		ipAddress,
	)

	return successResponse(c, user)
}

// GetUsersByCenter 获取中心下的所有用户
// @Summary 获取中心下的所有用户
// @Description 根据中心ID获取该中心下的所有用户（仅超管可访问）
// @Tags 用户管理
// @Accept json
// @Produce json
// @Param id path int true "中心ID"
// @Success 200 {object} Response{data=[]model.User} "成功"
// @Failure 401 {object} Response "未授权"
// @Failure 403 {object} Response "权限不足"
// @Router /api/user/center/{id} [get]
// @Security BearerAuth
func (h *UserHandler) GetUsersByCenter(c echo.Context) error {
	ctx := c.Request().Context()

	if !middleware.HasRole(ctx, middleware.RoleSuperAdmin) {
		return errorResponse(c, http.StatusForbidden, "仅超管可访问")
	}

	id, err := parseUint64Param(c, "id")
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, err.Error())
	}

	var users []model.User

	err = h.db.WithContext(ctx).
		Model(&model.User{}).
		Preload("Role").
		Preload("Center").
		Preload("Advisor").
		Where("center_id = ?", id).
		Order("created_at DESC").
		Find(&users).Error

	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	return successResponse(c, users)
}

// GetUsersByRole 获取指定角色的所有用户
// @Summary 获取指定角色的所有用户
// @Description 根据角色ID获取该角色的所有用户（仅超管可访问）
// @Tags 用户管理
// @Accept json
// @Produce json
// @Param id path int true "角色ID"
// @Success 200 {object} Response{data=[]model.User} "成功"
// @Failure 401 {object} Response "未授权"
// @Failure 403 {object} Response "权限不足"
// @Router /api/user/role/{id} [get]
// @Security BearerAuth
func (h *UserHandler) GetUsersByRole(c echo.Context) error {
	ctx := c.Request().Context()

	if !middleware.HasRole(ctx, middleware.RoleSuperAdmin) {
		return errorResponse(c, http.StatusForbidden, "仅超管可访问")
	}

	id, err := parseUint64Param(c, "id")
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, err.Error())
	}

	var users []model.User

	err = h.db.WithContext(ctx).
		Model(&model.User{}).
		Preload("Role").
		Preload("Center").
		Preload("Advisor").
		Where("role_id = ?", id).
		Order("created_at DESC").
		Find(&users).Error

	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	return successResponse(c, users)
}

// RegisterRoutes 注册用户管理路由
func (h *UserHandler) RegisterRoutes(e *echo.Group, authMiddleware echo.MiddlewareFunc) {
	user := e.Group("/user")
	user.Use(authMiddleware)

	user.GET("", h.GetUserList)
	user.GET("/:id", h.GetUserDetail)
	user.POST("", h.CreateUser)
	user.PUT("/:id", h.UpdateUser)
	user.DELETE("/:id", h.DeleteUser)
	user.PATCH("/:id/role", h.UpdateUserRole)
	user.GET("/center/:id", h.GetUsersByCenter)
	user.GET("/role/:id", h.GetUsersByRole)
}
