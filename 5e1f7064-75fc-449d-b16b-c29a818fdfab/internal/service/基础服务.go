package service

import (
	"crypto/sha256"
	"encoding/hex"
	"time"

	"lab-management/internal/model"
	appErr "lab-management/internal/pkg/errors"
	"lab-management/internal/pkg/config"
	"lab-management/internal/repository"
	"lab-management/internal/middleware"
	"lab-management/internal/dto"
)

type AuthService struct {
	userRepo *repository.UserRepository
	cfg      *config.Config
}

func NewAuthService(userRepo *repository.UserRepository, cfg *config.Config) *AuthService {
	return &AuthService{
		userRepo: userRepo,
		cfg:      cfg,
	}
}

func hashPassword(password string) string {
	h := sha256.New()
	h.Write([]byte(password))
	return hex.EncodeToString(h.Sum(nil))
}

func (s *AuthService) Login(req *dto.LoginRequest) (*dto.LoginResponse, *appErr.ErrorCode) {
	user, exists, err := s.userRepo.FindByUsername(req.Username)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	if !exists {
		return nil, appErr.ErrUnauthorized.WithMessage("用户名或密码错误")
	}
	if user.Status != 1 {
		return nil, appErr.ErrUnauthorized.WithMessage("账号已被禁用")
	}

	if user.PasswordHash != hashPassword(req.Password) {
		return nil, appErr.ErrUnauthorized.WithMessage("用户名或密码错误")
	}

	token, expiresIn, err := middleware.GenerateToken(user, s.cfg)
	if err != nil {
		return nil, appErr.ErrSystemError.WithMessage("生成Token失败")
	}

	now := time.Now()
	_ = s.userRepo.UpdateLastLogin(user.ID, now)

	instName := ""
	if user.Institution != nil {
		instName = user.Institution.Name
	}

	return &dto.LoginResponse{
		Token:     token,
		ExpiresIn: expiresIn,
		User: dto.UserInfo{
			ID:            user.ID,
			Username:      user.Username,
			RealName:      user.RealName,
			Role:          user.Role,
			InstitutionID: user.InstitutionID,
			Institution:   instName,
		},
	}, nil
}

type InstitutionService struct {
	repo *repository.InstitutionRepository
}

func NewInstitutionService(repo *repository.InstitutionRepository) *InstitutionService {
	return &InstitutionService{repo: repo}
}

func (s *InstitutionService) Create(req *dto.CreateInstitutionRequest) (uint, *appErr.ErrorCode) {
	_, exists, err := s.repo.FindByCode(req.Code)
	if err != nil {
		return 0, appErr.ErrDatabaseError
	}
	if exists {
		return 0, appErr.ErrConflict.WithMessage("机构代码已存在")
	}

	inst := &model.Institution{
		Code:     req.Code,
		Name:     req.Name,
		Type:     req.Type,
		Contact:  req.Contact,
		Phone:    req.Phone,
		Email:    req.Email,
		Address:  req.Address,
		Discount: req.Discount,
		MinPrice: req.MinPrice,
		Status:   1,
	}
	if inst.Discount == 0 {
		inst.Discount = 1.0
	}

	if err := s.repo.Create(inst); err != nil {
		return 0, appErr.ErrDatabaseError
	}
	return inst.ID, nil
}

func (s *InstitutionService) Update(id uint, req *dto.UpdateInstitutionRequest) *appErr.ErrorCode {
	inst, exists, err := s.repo.FindByID(id)
	if err != nil {
		return appErr.ErrDatabaseError
	}
	if !exists {
		return appErr.ErrInstitutionNotFound
	}

	if req.Name != "" {
		inst.Name = req.Name
	}
	if req.Type != "" {
		inst.Type = req.Type
	}
	if req.Contact != "" {
		inst.Contact = req.Contact
	}
	if req.Phone != "" {
		inst.Phone = req.Phone
	}
	if req.Email != "" {
		inst.Email = req.Email
	}
	if req.Address != "" {
		inst.Address = req.Address
	}
	if req.Discount > 0 {
		inst.Discount = req.Discount
	}
	if req.MinPrice >= 0 && req.MinPrice != inst.MinPrice {
		inst.MinPrice = req.MinPrice
	}
	if req.Status != nil {
		inst.Status = *req.Status
	}

	if err := s.repo.Save(inst); err != nil {
		return appErr.ErrDatabaseError
	}
	return nil
}

func (s *InstitutionService) GetByID(id uint) (*model.Institution, *appErr.ErrorCode) {
	inst, exists, err := s.repo.FindByID(id)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	if !exists {
		return nil, appErr.ErrInstitutionNotFound
	}
	return inst, nil
}

func (s *InstitutionService) List(q *dto.InstitutionQuery) ([]model.Institution, int64, *appErr.ErrorCode) {
	status := q.Status
	list, total, err := s.repo.List(q.Keyword, q.Type, status, q.Page, q.PageSize)
	if err != nil {
		return nil, 0, appErr.ErrDatabaseError
	}
	return list, total, nil
}

type TestItemService struct {
	itemRepo    *repository.TestItemRepository
	packageRepo *repository.TestItemPackageRepository
}

func NewTestItemService(itemRepo *repository.TestItemRepository, packageRepo *repository.TestItemPackageRepository) *TestItemService {
	return &TestItemService{
		itemRepo:    itemRepo,
		packageRepo: packageRepo,
	}
}

func (s *TestItemService) Create(req *dto.CreateTestItemRequest) (uint, *appErr.ErrorCode) {
	_, exists, err := s.itemRepo.FindByCode(req.Code)
	if err != nil {
		return 0, appErr.ErrDatabaseError
	}
	if exists {
		return 0, appErr.ErrConflict.WithMessage("检验项目代码已存在")
	}

	item := &model.TestItem{
		Code:           req.Code,
		Name:           req.Name,
		Category:       req.Category,
		SpecimenType:   req.SpecimenType,
		Unit:           req.Unit,
		RefRange:       req.RefRange,
		MinValue:       req.MinValue,
		MaxValue:       req.MaxValue,
		CriticalLow:    req.CriticalLow,
		CriticalHigh:   req.CriticalHigh,
		Price:          req.Price,
		Device:         req.Device,
		TurnaroundTime: req.TurnaroundTime,
		Description:    req.Description,
		Status:         1,
	}

	if err := s.itemRepo.Create(item); err != nil {
		return 0, appErr.ErrDatabaseError
	}
	return item.ID, nil
}

func (s *TestItemService) Update(id uint, req *dto.UpdateTestItemRequest) *appErr.ErrorCode {
	item, exists, err := s.itemRepo.FindByID(id)
	if err != nil {
		return appErr.ErrDatabaseError
	}
	if !exists {
		return appErr.ErrTestItemNotFound
	}

	if req.Name != "" {
		item.Name = req.Name
	}
	if req.Category != "" {
		item.Category = req.Category
	}
	if req.SpecimenType != "" {
		item.SpecimenType = req.SpecimenType
	}
	if req.Unit != "" {
		item.Unit = req.Unit
	}
	if req.RefRange != "" {
		item.RefRange = req.RefRange
	}
	if req.MinValue != nil {
		item.MinValue = req.MinValue
	}
	if req.MaxValue != nil {
		item.MaxValue = req.MaxValue
	}
	if req.CriticalLow != nil {
		item.CriticalLow = req.CriticalLow
	}
	if req.CriticalHigh != nil {
		item.CriticalHigh = req.CriticalHigh
	}
	if req.Price != nil {
		item.Price = *req.Price
	}
	if req.Device != "" {
		item.Device = req.Device
	}
	if req.TurnaroundTime != nil {
		item.TurnaroundTime = *req.TurnaroundTime
	}
	if req.Description != "" {
		item.Description = req.Description
	}
	if req.Status != nil {
		item.Status = *req.Status
	}

	if err := s.itemRepo.Save(item); err != nil {
		return appErr.ErrDatabaseError
	}
	return nil
}

func (s *TestItemService) GetByID(id uint) (*model.TestItem, *appErr.ErrorCode) {
	item, exists, err := s.itemRepo.FindByID(id)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	if !exists {
		return nil, appErr.ErrTestItemNotFound
	}
	return item, nil
}

func (s *TestItemService) List(q *dto.TestItemQuery) ([]model.TestItem, int64, *appErr.ErrorCode) {
	status := q.Status
	list, total, err := s.itemRepo.List(q.Keyword, q.Category, status, q.Page, q.PageSize)
	if err != nil {
		return nil, 0, appErr.ErrDatabaseError
	}
	return list, total, nil
}
