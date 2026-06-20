package handler

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labelops/backend/internal/middleware"
	"github.com/labelops/backend/internal/model"
	"github.com/labelops/backend/internal/store"
	"github.com/labelops/backend/internal/util"
)

type WorkHandler struct {
	repo  *store.MockRepo
	redis *store.RedisStore
}

func NewWorkHandler(repo *store.MockRepo, redis *store.RedisStore) *WorkHandler {
	return &WorkHandler{repo: repo, redis: redis}
}

type ListWorksRequest struct {
	Brand    model.Brand     `query:"brand"`
	Status   model.WorkStatus `query:"status"`
	Type     model.WorkType  `query:"type"`
	Keyword  string          `query:"keyword"`
	Page     int             `query:"page"`
	PageSize int             `query:"page_size"`
}

type PagedResponse struct {
	Total   int64       `json:"total"`
	Page    int         `json:"page"`
	PageSize int        `json:"page_size"`
	Data    interface{} `json:"data"`
}

func (h *WorkHandler) ListWorks(c echo.Context) error {
	req := ListWorksRequest{
		Page:     1,
		PageSize: 20,
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid parameters")
	}
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 || req.PageSize > 100 {
		req.PageSize = 20
	}
	offset := (req.Page - 1) * req.PageSize

	ctx := c.Request().Context()
	cacheKey := "works:list:" + strconv.Itoa(int(req.Brand[0])) + ":" + string(req.Status) + ":" + string(req.Type) + ":" + req.Keyword + ":" + strconv.Itoa(req.Page) + ":" + strconv.Itoa(req.PageSize)

	type cachedResult struct {
		Data  []*model.Work `json:"data"`
		Total int64         `json:"total"`
	}
	var cached cachedResult
	found, _ := h.redis.Get(ctx, cacheKey, &cached)
	if found && len(cached.Data) > 0 {
		return c.JSON(http.StatusOK, PagedResponse{
			Total:    cached.Total,
			Page:     req.Page,
			PageSize: req.PageSize,
			Data:     cached.Data,
		})
	}

	works, total := h.repo.ListWorks(req.Brand, req.Status, req.Type, req.Keyword, offset, req.PageSize)
	go func() {
		_ = h.redis.Set(context.Background(), cacheKey, cachedResult{Data: works, Total: total}, 30*time.Second)
	}()

	return c.JSON(http.StatusOK, PagedResponse{
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
		Data:     works,
	})
}

func (h *WorkHandler) GetWork(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing work id")
	}

	ctx := c.Request().Context()
	cacheKey := store.KeyWork(id)
	var cached model.Work
	found, _ := h.redis.Get(ctx, cacheKey, &cached)
	if found && cached.ID != "" {
		return c.JSON(http.StatusOK, cached)
	}

	w := h.repo.GetWork(id)
	if w == nil {
		return echo.NewHTTPError(http.StatusNotFound, "work not found")
	}

	go func() {
		_ = h.redis.Set(context.Background(), cacheKey, w, 5*time.Minute)
	}()

	return c.JSON(http.StatusOK, w)
}

type CreateWorkRequest struct {
	Title       string              `json:"title" validate:"required"`
	Type        model.WorkType      `json:"type" validate:"required"`
	Brand       model.Brand         `json:"brand" validate:"required"`
	Genre       string              `json:"genre"`
	Duration    int                 `json:"duration"`
	ISRC        string              `json:"isrc"`
	ISWC        string              `json:"iswc"`
	Contributors []CreateContributorReq `json:"contributors"`
}

type CreateContributorReq struct {
	ArtistID string                `json:"artist_id"`
	Role     model.ContributorRole `json:"role"`
}

func (h *WorkHandler) CreateWork(c echo.Context) error {
	var req CreateWorkRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Title == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "title is required")
	}

	id := util.NewID()
	w := &model.Work{
		ID:        id,
		Title:     req.Title,
		Type:      req.Type,
		Brand:     req.Brand,
		Status:    model.WorkStatusDemo,
		Genre:     req.Genre,
		Duration:  req.Duration,
		ISRC:      req.ISRC,
		ISWC:      req.ISWC,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	for _, creq := range req.Contributors {
		a := h.repo.GetArtist(creq.ArtistID)
		if a == nil {
			continue
		}
		w.Contributors = append(w.Contributors, model.Contributor{
			ID:         util.NewID(),
			WorkID:     id,
			ArtistID:   creq.ArtistID,
			ArtistName: a.Name,
			Role:       creq.Role,
		})
	}

	h.repo.SaveWork(w)
	h.invalidateWorkCache()

	return c.JSON(http.StatusCreated, w)
}

type UpdateWorkStatusRequest struct {
	Status model.WorkStatus `json:"status"`
	Note   string           `json:"note"`
}

func (h *WorkHandler) UpdateWorkStatus(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing work id")
	}
	var req UpdateWorkStatusRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Status == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "status is required")
	}

	w := h.repo.GetWork(id)
	if w == nil {
		return echo.NewHTTPError(http.StatusNotFound, "work not found")
	}

	transition := map[model.WorkStatus][]model.WorkStatus{
		model.WorkStatusDemo:      {model.WorkStatusArranging},
		model.WorkStatusArranging: {model.WorkStatusMixing, model.WorkStatusDemo},
		model.WorkStatusMixing:    {model.WorkStatusMastering, model.WorkStatusArranging},
		model.WorkStatusMastering: {model.WorkStatusReviewing, model.WorkStatusMixing},
		model.WorkStatusReviewing: {model.WorkStatusReleased, model.WorkStatusMastering},
		model.WorkStatusReleased:  {},
	}

	allowed := false
	for _, allowedNext := range transition[w.Status] {
		if allowedNext == req.Status {
			allowed = true
			break
		}
	}
	if w.Status == req.Status {
		allowed = true
	}
	if !allowed {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid status transition from "+string(w.Status)+" to "+string(req.Status))
	}

	w.Status = req.Status
	if req.Status == model.WorkStatusReleased && w.ReleaseDate == nil {
		now := time.Now()
		w.ReleaseDate = &now
	}
	h.repo.SaveWork(w)
	h.invalidateWorkCache()

	userClaims := middleware.GetUserFromContext(c)
	h.auditLog(userClaims, "UPDATE_WORK_STATUS", "work", id, "status:"+string(req.Status)+" note:"+req.Note)

	return c.JSON(http.StatusOK, w)
}

func (h *WorkHandler) UploadVersion(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing work id")
	}
	w := h.repo.GetWork(id)
	if w == nil {
		return echo.NewHTTPError(http.StatusNotFound, "work not found")
	}

	version := c.FormValue("version")
	note := c.FormValue("note")
	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "file upload failed")
	}
	if version == "" {
		version = "v" + strconv.Itoa(len(w.Versions)+1) + ".0"
	}

	userClaims := middleware.GetUserFromContext(c)
	creatorID := ""
	if userClaims != nil {
		creatorID = userClaims.UserID
	}

	fileURL := "https://cdn.labelops.com/works/" + id + "/" + file.Filename
	wv := model.WorkVersion{
		ID:               util.NewID(),
		WorkID:           id,
		Version:          version,
		Status:           w.Status,
		FileURL:          fileURL,
		FileSize:         file.Size,
		AudioFingerprint: util.RandomHex(32),
		CreatedAt:        time.Now(),
		CreatedBy:        creatorID,
		Note:             note,
	}
	w.Versions = append(w.Versions, wv)
	h.repo.SaveWork(w)
	h.invalidateWorkCache()

	return c.JSON(http.StatusCreated, wv)
}

type CreateAuthLinkRequest struct {
	ParentWorkID *string        `json:"parent_work_id"`
	ParentTitle  string         `json:"parent_title"`
	AuthType     model.AuthType `json:"auth_type"`
	LicenseType  string         `json:"license_type"`
	AuthDocURL   string         `json:"auth_doc_url"`
	Fee          float64        `json:"fee"`
	Note         string         `json:"note"`
}

func (h *WorkHandler) CreateAuthLink(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing work id")
	}
	w := h.repo.GetWork(id)
	if w == nil {
		return echo.NewHTTPError(http.StatusNotFound, "work not found")
	}
	var req CreateAuthLinkRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.AuthType == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "auth_type is required")
	}

	status := model.AuthStatusPending
	if req.AuthDocURL != "" {
		status = model.AuthStatusApproved
	}
	now := time.Now()
	link := model.AuthLink{
		ID:           util.NewID(),
		WorkID:       id,
		ParentWorkID: req.ParentWorkID,
		ParentTitle:  req.ParentTitle,
		AuthType:     req.AuthType,
		LicenseType:  req.LicenseType,
		AuthStatus:   status,
		AuthDocURL:   req.AuthDocURL,
		AuthDate:     &now,
		Fee:          req.Fee,
		Note:         req.Note,
	}
	w.AuthChain = append(w.AuthChain, link)
	h.repo.SaveWork(w)
	h.invalidateWorkCache()
	return c.JSON(http.StatusCreated, link)
}

func (h *WorkHandler) ValidateCoverAuth(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing work id")
	}
	w := h.repo.GetWork(id)
	if w == nil {
		return echo.NewHTTPError(http.StatusNotFound, "work not found")
	}

	result := struct {
		Authorized  bool   `json:"authorized"`
		Reason      string `json:"reason"`
		AuthChain   []model.AuthLink `json:"auth_chain"`
		PendingLinks []string        `json:"pending_links"`
	}{
		Authorized: true,
		AuthChain:  w.AuthChain,
	}

	var pending []string
	for _, l := range w.AuthChain {
		if l.AuthStatus == model.AuthStatusPending {
			result.Authorized = false
			pending = append(pending, l.ParentTitle+":"+string(l.AuthType))
		} else if l.AuthStatus == model.AuthStatusRejected {
			result.Authorized = false
			result.Reason = "授权被拒绝：" + l.ParentTitle
			result.PendingLinks = pending
			return c.JSON(http.StatusOK, result)
		} else if l.AuthStatus == model.AuthStatusExpired {
			result.Authorized = false
			result.Reason = "授权已过期：" + l.ParentTitle
			result.PendingLinks = pending
			return c.JSON(http.StatusOK, result)
		}
	}
	if !result.Authorized && result.Reason == "" {
		result.Reason = "存在待审核的授权链接"
	}
	result.PendingLinks = pending
	return c.JSON(http.StatusOK, result)
}

func (h *WorkHandler) ListArtists(c echo.Context) error {
	brand := model.Brand(c.QueryParam("brand"))
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("page_size"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize
	artists, total := h.repo.ListArtists(brand, offset, pageSize)
	return c.JSON(http.StatusOK, PagedResponse{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		Data:     artists,
	})
}

func (h *WorkHandler) GetArtist(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing artist id")
	}
	a := h.repo.GetArtist(id)
	if a == nil {
		return echo.NewHTTPError(http.StatusNotFound, "artist not found")
	}
	return c.JSON(http.StatusOK, a)
}

func (h *WorkHandler) invalidateWorkCache() {
	ctx := context.Background()
	keys, _ := h.redis.Keys(ctx, "works:list:*")
	for _, k := range keys {
		_ = h.redis.Delete(ctx, k)
	}
}

func (h *WorkHandler) auditLog(claims *middleware.Claims, action, resource, resourceID, detail string) {
	ip := ""
	userID := ""
	username := ""
	if claims != nil {
		userID = claims.UserID
		username = claims.Username
	}
	log := &model.AuditLog{
		ID:         util.NewID(),
		UserID:     userID,
		Username:   username,
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		Detail:     detail,
		IP:         ip,
	}
	h.repo.AddAuditLog(log)
}
