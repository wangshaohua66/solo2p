package service

import (
	"context"
	"fmt"
	"time"

	"smart-lighting-api/config"
	"smart-lighting-api/middleware"
	"smart-lighting-api/model"
	"smart-lighting-api/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	db       *gorm.DB
	userRepo *repository.UserRepo
}

func NewAuthService(db *gorm.DB, userRepo *repository.UserRepo) *AuthService {
	return &AuthService{
		db:       db,
		userRepo: userRepo,
	}
}

type LoginRequest struct {
	Username string `json:"username" validate:"required,min=3,max=64"`
	Password string `json:"password" validate:"required,min=6,max=64"`
}

type LoginResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	User      *UserInfo `json:"user"`
}

type UserInfo struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	RealName string `json:"real_name"`
	Role     string `json:"role"`
	AreaID   int64  `json:"area_id"`
	Phone    string `json:"phone"`
	Email    string `json:"email"`
}

func (s *AuthService) Login(ctx context.Context, req *LoginRequest) (*LoginResponse, error) {
	user, err := s.userRepo.GetByUsername(ctx, req.Username)
	if err != nil {
		return nil, fmt.Errorf("用户名或密码错误")
	}
	if user.Status != 1 {
		return nil, fmt.Errorf("账户已被禁用")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, fmt.Errorf("用户名或密码错误")
	}
	token, expiresAt, err := s.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("生成token失败")
	}
	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)
	return &LoginResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		User: &UserInfo{
			ID:       user.ID,
			Username: user.Username,
			RealName: user.RealName,
			Role:     user.Role,
			AreaID:   user.AreaID,
			Phone:    user.Phone,
			Email:    user.Email,
		},
	}, nil
}

func (s *AuthService) generateToken(user *model.User) (string, time.Time, error) {
	jwtCfg := config.AppConf.JWT
	expireAt := time.Now().Add(time.Duration(jwtCfg.ExpireHours) * time.Hour)
	claims := middleware.UserClaims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		AreaID:   user.AreaID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expireAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    jwtCfg.Issuer,
			Subject:   user.Username,
			ID:        uuid.New().String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(jwtCfg.Secret))
	return tokenStr, expireAt, err
}

func (s *AuthService) Logout(ctx context.Context, tokenStr string, userID int64) error {
	hashedToken := middleware.HashToken(tokenStr)
	expireHours := config.AppConf.JWT.ExpireHours
	expiresAt := time.Now().Add(time.Duration(expireHours) * time.Hour)
	return s.userRepo.AddToBlacklist(ctx, hashedToken, expiresAt)
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" validate:"required,min=6,max=64"`
	NewPassword string `json:"new_password" validate:"required,min=6,max=64"`
}

func (s *AuthService) ChangePassword(ctx context.Context, userID int64, req *ChangePasswordRequest) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("用户不存在")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.OldPassword)); err != nil {
		return fmt.Errorf("原密码错误")
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.userRepo.UpdatePassword(ctx, userID, string(hashed))
}

func (s *AuthService) CreateUser(ctx context.Context, user *model.User, password string) (*model.User, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	user.Password = string(hashed)
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	if user.Status == 0 {
		user.Status = 1
	}
	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *AuthService) GetUserByID(ctx context.Context, id int64) (*UserInfo, error) {
	user, err := s.userRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &UserInfo{
		ID:       user.ID,
		Username: user.Username,
		RealName: user.RealName,
		Role:     user.Role,
		AreaID:   user.AreaID,
		Phone:    user.Phone,
		Email:    user.Email,
	}, nil
}

func (s *AuthService) InitDefaultAdmin(ctx context.Context) error {
	_, err := s.userRepo.GetByUsername(ctx, "admin")
	if err == nil {
		return nil
	}
	hashed, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	admin := &model.User{
		Username: "admin",
		Password: string(hashed),
		RealName: "系统管理员",
		Role:     model.RoleAdmin,
		AreaID:   0,
		Status:   1,
		Phone:    "13800000000",
		Email:    "admin@smart-lighting.com",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := s.userRepo.Create(ctx, admin); err != nil {
		return err
	}
	return nil
}
