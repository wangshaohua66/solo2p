package controller

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"lab-management/internal/dto"
	appErr "lab-management/internal/pkg/errors"
	"lab-management/internal/pkg/response"
	"lab-management/internal/service"
)

var validate = validator.New()

type BaseController struct {
	authService        *service.AuthService
	institutionService *service.InstitutionService
	testItemService    *service.TestItemService
}

func NewBaseController(
	authService *service.AuthService,
	institutionService *service.InstitutionService,
	testItemService *service.TestItemService,
) *BaseController {
	return &BaseController{
		authService:        authService,
		institutionService: institutionService,
		testItemService:    testItemService,
	}
}

func (c *BaseController) bindAndValidate(ctx *gin.Context, req interface{}) bool {
	if err := ctx.ShouldBind(req); err != nil {
		if errs, ok := err.(validator.ValidationErrors); ok {
			if len(errs) > 0 {
				firstErr := errs[0]
				msg := firstErr.Field() + ": " + firstErr.Tag()
				response.Fail(ctx, appErr.ErrInvalidParams.WithMessage(msg))
				return false
			}
		}
		response.Fail(ctx, appErr.ErrInvalidParams.WithMessage(err.Error()))
		return false
	}
	return true
}

func (c *BaseController) bindQueryAndValidate(ctx *gin.Context, req interface{}) bool {
	if err := ctx.ShouldBindQuery(req); err != nil {
		if errs, ok := err.(validator.ValidationErrors); ok {
			if len(errs) > 0 {
				firstErr := errs[0]
				msg := firstErr.Field() + ": " + firstErr.Tag()
				response.Fail(ctx, appErr.ErrInvalidParams.WithMessage(msg))
				return false
			}
		}
		response.Fail(ctx, appErr.ErrInvalidParams.WithMessage(err.Error()))
		return false
	}
	return true
}

func getUintID(ctx *gin.Context, key string) (uint, bool) {
	str := ctx.Param(key)
	id, err := strconv.ParseUint(str, 10, 64)
	if err != nil {
		response.Fail(ctx, appErr.ErrInvalidParams.WithMessage("ID格式错误"))
		return 0, false
	}
	return uint(id), true
}

func getCurrentUserID(ctx *gin.Context) uint {
	id, exists := ctx.Get("user_id")
	if !exists {
		return 0
	}
	if uid, ok := id.(uint); ok {
		return uid
	}
	return 0
}

func getCurrentInstitutionID(ctx *gin.Context) uint {
	id, exists := ctx.Get("institution_id")
	if !exists {
		return 0
	}
	if iid, ok := id.(uint); ok {
		return iid
	}
	return 0
}

func (c *BaseController) Login(ctx *gin.Context) {
	var req dto.LoginRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	resp, ec := c.authService.Login(&req)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, resp)
}

func (c *BaseController) CreateInstitution(ctx *gin.Context) {
	var req dto.CreateInstitutionRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	id, ec := c.institutionService.Create(&req)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, gin.H{"id": id})
}

func (c *BaseController) UpdateInstitution(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	var req dto.UpdateInstitutionRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	if ec := c.institutionService.Update(id, &req); ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, nil)
}

func (c *BaseController) GetInstitution(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	inst, ec := c.institutionService.GetByID(id)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, inst)
}

func (c *BaseController) ListInstitution(ctx *gin.Context) {
	var req dto.InstitutionQuery
	if !c.bindQueryAndValidate(ctx, &req) {
		return
	}
	list, total, ec := c.institutionService.List(&req)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.SuccessPage(ctx, list, total, req.Page, req.PageSize)
}

func (c *BaseController) CreateTestItem(ctx *gin.Context) {
	var req dto.CreateTestItemRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	id, ec := c.testItemService.Create(&req)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, gin.H{"id": id})
}

func (c *BaseController) UpdateTestItem(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	var req dto.UpdateTestItemRequest
	if !c.bindAndValidate(ctx, &req) {
		return
	}
	if ec := c.testItemService.Update(id, &req); ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, nil)
}

func (c *BaseController) GetTestItem(ctx *gin.Context) {
	id, ok := getUintID(ctx, "id")
	if !ok {
		return
	}
	item, ec := c.testItemService.GetByID(id)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.Success(ctx, item)
}

func (c *BaseController) ListTestItem(ctx *gin.Context) {
	var req dto.TestItemQuery
	if !c.bindQueryAndValidate(ctx, &req) {
		return
	}
	list, total, ec := c.testItemService.List(&req)
	if ec != nil {
		response.Fail(ctx, ec)
		return
	}
	response.SuccessPage(ctx, list, total, req.Page, req.PageSize)
}
