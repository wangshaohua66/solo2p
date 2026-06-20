package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labelops/backend/internal/model"
	"github.com/labelops/backend/internal/service"
	"github.com/labelops/backend/internal/store"
)

type MonitorHandler struct {
	repo    *store.MockRepo
	redis   *store.RedisStore
	crawler *service.CrawlerService
	monitor *service.MonitorService
}

func NewMonitorHandler(repo *store.MockRepo, redis *store.RedisStore, crawler *service.CrawlerService, monitor *service.MonitorService) *MonitorHandler {
	return &MonitorHandler{
		repo:    repo,
		redis:   redis,
		crawler: crawler,
		monitor: monitor,
	}
}

type ListPiraciesRequest struct {
	Status   model.PiracyStatus `query:"status"`
	WorkID   string             `query:"work_id"`
	Page     int                `query:"page"`
	PageSize int                `query:"page_size"`
}

func (h *MonitorHandler) ListPiracies(c echo.Context) error {
	req := ListPiraciesRequest{Page: 1, PageSize: 20}
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

	list, total := h.repo.ListPiracies(req.Status, req.WorkID, offset, req.PageSize)
	return c.JSON(http.StatusOK, PagedResponse{
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
		Data:     list,
	})
}

func (h *MonitorHandler) GetPiracy(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing id")
	}
	pr := h.repo.GetPiracy(id)
	if pr == nil {
		return echo.NewHTTPError(http.StatusNotFound, "piracy record not found")
	}
	return c.JSON(http.StatusOK, pr)
}

type ScanPiracyRequest struct {
	WorkID    string  `json:"work_id"`
	Threshold float64 `json:"threshold"`
}

func (h *MonitorHandler) ScanPiracy(c echo.Context) error {
	var req ScanPiracyRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Threshold <= 0 || req.Threshold > 1 {
		req.Threshold = 0.8
	}

	if req.WorkID == "" {
		total, err := h.monitor.ScanAllWorks(c.Request().Context(), req.Threshold)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		return c.JSON(http.StatusOK, map[string]interface{}{
			"total_detected": total,
			"mode":           "all_works",
			"threshold":      req.Threshold,
		})
	}

	records, err := h.monitor.ScanPiracyForWork(c.Request().Context(), req.WorkID, req.Threshold)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"records":  records,
		"count":    len(records),
		"work_id":  req.WorkID,
		"threshold": req.Threshold,
	})
}

type ResolvePiracyRequest struct {
	Action    string `json:"action"`
	Dismissed bool   `json:"dismissed"`
}

func (h *MonitorHandler) ResolvePiracy(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing id")
	}
	var req ResolvePiracyRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	pr := h.repo.GetPiracy(id)
	if pr == nil {
		return echo.NewHTTPError(http.StatusNotFound, "piracy record not found")
	}

	if req.Action == "generate_letter" || req.Action == "" && !req.Dismissed {
		tplType := c.QueryParam("template_type")
		if tplType == "" {
			tplType = "cease_desist"
		}
		letter, err := h.monitor.GenerateRightsLetter(id, tplType)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		return c.JSON(http.StatusOK, map[string]interface{}{
			"letter": letter,
			"record": h.repo.GetPiracy(id),
		})
	}

	if err := h.monitor.ResolvePiracy(id, req.Dismissed); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, h.repo.GetPiracy(id))
}

type CrawlRequest struct {
	Platform  model.Platform `json:"platform"`
	WorkIDs   []string       `json:"work_ids"`
	StartDate string         `json:"start_date"`
	EndDate   string         `json:"end_date"`
	MaxRetry  int            `json:"max_retry"`
}

func (h *MonitorHandler) TriggerCrawl(c echo.Context) error {
	var req CrawlRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Platform == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "platform is required")
	}

	start := time.Now().AddDate(0, 0, -7)
	end := time.Now()
	if req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", req.StartDate); err == nil {
			start = t
		}
	}
	if req.EndDate != "" {
		if t, err := time.Parse("2006-01-02", req.EndDate); err == nil {
			end = t
		}
	}
	if req.MaxRetry < 0 || req.MaxRetry > 10 {
		req.MaxRetry = 3
	}

	task, err := h.crawler.CrawlPlatformData(c.Request().Context(), req.Platform, req.WorkIDs, start, end, req.MaxRetry)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusAccepted, task)
}

func (h *MonitorHandler) GetCrawlerTask(c echo.Context) error {
	id := c.Param("id")
	task := h.crawler.GetTask(id)
	if task == nil {
		return echo.NewHTTPError(http.StatusNotFound, "task not found")
	}
	return c.JSON(http.StatusOK, task)
}

type CompareFingerprintRequest struct {
	Fingerprint1 string `json:"fingerprint1"`
	Fingerprint2 string `json:"fingerprint2"`
}

func (h *MonitorHandler) CompareFingerprint(c echo.Context) error {
	var req CompareFingerprintRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Fingerprint1 == "" || req.Fingerprint2 == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "both fingerprints are required")
	}
	result := h.monitor.CompareFingerprints(req.Fingerprint1, req.Fingerprint2)
	return c.JSON(http.StatusOK, map[string]interface{}{
		"score":   result.Score,
		"reason":  result.Reason,
		"match_pct": strconv.FormatFloat(result.Score*100, 'f', 2, 64) + "%",
	})
}

type PlatformSummaryRequest struct {
	StartDate string         `query:"start_date"`
	EndDate   string         `query:"end_date"`
	Platform  model.Platform `query:"platform"`
	WorkID    string         `query:"work_id"`
}

type PlatformSummary struct {
	Platform      model.Platform `json:"platform"`
	PlatformName  string         `json:"platform_name"`
	PlayCount     int64          `json:"play_count"`
	DownloadCount int64          `json:"download_count"`
	FavoriteCount int64          `json:"favorite_count"`
	TotalRevenue  float64        `json:"total_revenue"`
	RecordCount   int            `json:"record_count"`
	WorksCount    int            `json:"works_count"`
}

func (h *MonitorHandler) PlatformDataSummary(c echo.Context) error {
	req := PlatformSummaryRequest{}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid parameters")
	}

	end := time.Now()
	start := end.AddDate(0, 0, -30)
	if req.EndDate != "" {
		if t, err := time.Parse("2006-01-02", req.EndDate); err == nil {
			end = t
		}
	}
	if req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", req.StartDate); err == nil {
			start = t
		}
	}

	platforms := []model.Platform{
		model.PlatformNetEase, model.PlatformQQMusic, model.PlatformKugou,
		model.PlatformKuwo, model.PlatformSpotify, model.PlatformAppleMusic,
	}

	results := make([]PlatformSummary, 0)
	startStr := start.Format("2006-01-02")
	endStr := end.Format("2006-01-02")

	workSet := make(map[string]bool)

	for _, p := range platforms {
		if req.Platform != "" && req.Platform != p {
			continue
		}
		list := h.repo.ListPlatformData(req.WorkID, p, startStr, endStr)
		ps := PlatformSummary{
			Platform:     p,
			PlatformName: model.PlatformNames[p],
			RecordCount:  len(list),
		}
		localWorks := make(map[string]bool)
		for _, pd := range list {
			ps.PlayCount += pd.PlayCount
			ps.DownloadCount += pd.DownloadCount
			ps.FavoriteCount += pd.FavoriteCount
			ps.TotalRevenue += pd.Revenue
			workSet[pd.WorkID] = true
			localWorks[pd.WorkID] = true
		}
		ps.WorksCount = len(localWorks)
		results = append(results, ps)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"period":       [2]string{startStr, endStr},
		"platforms":    results,
		"total_works":  len(workSet),
		"total_records": func() int {
			c := 0
			for _, r := range results {
				c += r.RecordCount
			}
			return c
		}(),
	})
}
