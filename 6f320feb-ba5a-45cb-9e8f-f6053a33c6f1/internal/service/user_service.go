package service

import (
	"errors"
	"equipment-trading-platform/internal/model"
	"equipment-trading-platform/internal/repository"
	"equipment-trading-platform/internal/util"
	"equipment-trading-platform/pkg/logger"

	"gorm.io/gorm"
)

type UserService struct {
	userRepo *repository.UserRepository
}

func NewUserService() *UserService {
	return &UserService{
		userRepo: repository.NewUserRepository(),
	}
}

type RegisterRequest struct {
	Username string   `json:"username" binding:"required,min=3,max=64"`
	Password string   `json:"password" binding:"required,min=6,max=64"`
	RealName string   `json:"real_name"`
	Phone    string   `json:"phone"`
	Email    string   `json:"email"`
	Company  string   `json:"company"`
	Roles    []string `json:"roles"`
}

func (s *UserService) Register(req *RegisterRequest) (*model.User, error) {
	_, err := s.userRepo.GetByUsername(req.Username)
	if err == nil {
		return nil, util.ErrUserExists
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	hashedPassword, err := util.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	user := &model.User{
		Username: req.Username,
		Password: hashedPassword,
		RealName: req.RealName,
		Phone:    req.Phone,
		Email:    req.Email,
		Company:  req.Company,
		Status:   model.UserStatusActive,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	if len(req.Roles) == 0 {
		req.Roles = []string{model.RoleBuyer}
	}

	for _, roleName := range req.Roles {
		role, err := s.userRepo.GetRoleByName(roleName)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			logger.Warnf("get role %s failed: %v", roleName, err)
			continue
		}
		if err := s.userRepo.AddRole(user.ID, role.ID); err != nil {
			logger.Warnf("add role %s to user %d failed: %v", roleName, user.ID, err)
		}
	}

	if _, err := s.userRepo.GetOrCreateCreditRating(user.ID); err != nil {
		logger.Warnf("create credit rating for user %d failed: %v", user.ID, err)
	}

	return user, nil
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token    string      `json:"token"`
	User     *model.User `json:"user"`
	Roles    []string    `json:"roles"`
	ExpireIn int         `json:"expire_in"`
}

func (s *UserService) Login(req *LoginRequest) (*LoginResponse, error) {
	user, err := s.userRepo.GetByUsername(req.Username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, util.ErrUserNotFound
		}
		return nil, err
	}

	if user.Status == model.UserStatusDisabled {
		return nil, util.ErrUserDisabled
	}
	if user.Status == model.UserStatusBlacklisted {
		return nil, util.NewAppError(403, 1005, "账号已被列入黑名单")
	}

	if !util.CheckPassword(req.Password, user.Password) {
		return nil, util.ErrPassword
	}

	roles, err := s.userRepo.GetUserRoles(user.ID)
	if err != nil {
		return nil, err
	}

	token, err := util.GenerateToken(user.ID, user.Username, roles)
	if err != nil {
		return nil, err
	}

	return &LoginResponse{
		Token:    token,
		User:     user,
		Roles:    roles,
		ExpireIn: 86400,
	}, nil
}

func (s *UserService) GetByID(id uint64) (*model.User, error) {
	user, err := s.userRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, util.ErrUserNotFound
		}
		return nil, err
	}
	return user, nil
}

func (s *UserService) List(page, pageSize int) ([]*model.User, int64, error) {
	return s.userRepo.List(page, pageSize)
}

func (s *UserService) Update(id uint64, updates map[string]interface{}) error {
	user, err := s.userRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return util.ErrUserNotFound
		}
		return err
	}

	if password, ok := updates["password"].(string); ok && password != "" {
		hashed, err := util.HashPassword(password)
		if err != nil {
			return err
		}
		updates["password"] = hashed
	}

	return s.userRepo.GetDB().Model(user).Updates(updates).Error
}

func (s *UserService) UpdateStatus(id uint64, status string) error {
	return s.Update(id, map[string]interface{}{"status": status})
}

func (s *UserService) ChangePassword(userID uint64, oldPassword, newPassword string) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}

	if !util.CheckPassword(oldPassword, user.Password) {
		return util.ErrPassword
	}

	hashed, err := util.HashPassword(newPassword)
	if err != nil {
		return err
	}

	return s.Update(userID, map[string]interface{}{"password": hashed})
}

func (s *UserService) InitRoles() error {
	roles := []*model.Role{
		{Name: model.RoleAdmin, Description: "系统管理员"},
		{Name: model.RoleSeller, Description: "卖家"},
		{Name: model.RoleBuyer, Description: "买家"},
		{Name: model.RoleAssessor, Description: "评估师"},
		{Name: model.RoleArbitrator, Description: "仲裁员"},
	}

	for _, role := range roles {
		_, err := s.userRepo.GetRoleByName(role.Name)
		if err == nil {
			continue
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := s.userRepo.CreateRole(role); err != nil {
				logger.Warnf("create role %s failed: %v", role.Name, err)
			}
		}
	}
	return nil
}

func (s *UserService) ListRoles() ([]*model.Role, error) {
	return s.userRepo.ListRoles()
}
