package auth

import (
	"context"
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"

	"offshore-wind-ops/internal/middleware"
	"offshore-wind-ops/internal/model"
	"offshore-wind-ops/internal/repository"
)

type Service struct {
	userRepo *repository.UserRepository
	authRepo *repository.AuthRepository
	jwtCfg   *middleware.JWTConfig
}

func NewService(userRepo *repository.UserRepository, authRepo *repository.AuthRepository, jwtCfg *middleware.JWTConfig) *Service {
	return &Service{
		userRepo: userRepo,
		authRepo: authRepo,
		jwtCfg:   jwtCfg,
	}
}

func (s *Service) Login(ctx context.Context, req *model.LoginRequest) (*model.LoginResponse, error) {
	user, err := s.userRepo.GetByUsername(ctx, req.Username)
	if err != nil {
		return nil, errors.New("invalid username or password")
	}

	if user.Status != "active" {
		return nil, errors.New("user account is disabled")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid username or password")
	}

	accessToken, expiresAt, err := middleware.GenerateAccessToken(user, s.jwtCfg)
	if err != nil {
		return nil, err
	}

	refreshToken, refreshExpiresAt, err := middleware.GenerateRefreshToken(user, s.jwtCfg)
	if err != nil {
		return nil, err
	}

	if err := s.authRepo.SaveRefreshToken(ctx, refreshToken, user.ID.Hex(), refreshExpiresAt); err != nil {
		return nil, err
	}

	return &model.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
		User:         user,
	}, nil
}

func (s *Service) RefreshToken(ctx context.Context, refreshToken string) (*model.LoginResponse, error) {
	rt, err := s.authRepo.GetRefreshToken(ctx, refreshToken)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	if rt.ExpiresAt.Before(time.Now()) {
		_ = s.authRepo.DeleteRefreshToken(ctx, refreshToken)
		return nil, errors.New("refresh token expired")
	}

	user, err := s.userRepo.GetByID(ctx, rt.UserID)
	if err != nil {
		return nil, errors.New("user not found")
	}

	accessToken, expiresAt, err := middleware.GenerateAccessToken(user, s.jwtCfg)
	if err != nil {
		return nil, err
	}

	newRefreshToken, refreshExpiresAt, err := middleware.GenerateRefreshToken(user, s.jwtCfg)
	if err != nil {
		return nil, err
	}

	_ = s.authRepo.DeleteRefreshToken(ctx, refreshToken)
	if err := s.authRepo.SaveRefreshToken(ctx, newRefreshToken, user.ID.Hex(), refreshExpiresAt); err != nil {
		return nil, err
	}

	return &model.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresAt:    expiresAt,
		User:         user,
	}, nil
}

func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	return s.authRepo.DeleteRefreshToken(ctx, refreshToken)
}

func (s *Service) LogoutAll(ctx context.Context, userID string) error {
	return s.authRepo.DeleteByUserID(ctx, userID)
}

func (s *Service) GetUser(ctx context.Context, userID string) (*model.User, error) {
	return s.userRepo.GetByID(ctx, userID)
}

func (s *Service) ListUsers(ctx context.Context, page, pageSize int) ([]model.User, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return s.userRepo.List(ctx, nil, page, pageSize)
}

func (s *Service) CreateUser(ctx context.Context, user *model.User, password string) (*model.User, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	user.PasswordHash = string(hashedPassword)
	user.Status = "active"
	err = s.userRepo.Create(ctx, user)
	return user, err
}

func HashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hashed), err
}
