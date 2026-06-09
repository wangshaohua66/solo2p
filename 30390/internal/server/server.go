package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gitmon/gitmon/internal/analyzer"
	"github.com/gitmon/gitmon/internal/config"
	"github.com/gitmon/gitmon/internal/git"
	"github.com/gitmon/gitmon/internal/storage"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

type Server struct {
	e        *echo.Echo
	cfg      *config.Config
	store    *storage.Store
	analyzer *analyzer.Analyzer
	addr     string
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func New(cfg *config.Config, store *storage.Store, an *analyzer.Analyzer) *Server {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	e.Use(middleware.Recover())
	e.Use(middleware.CORS())
	e.Use(middleware.Gzip())
	e.Use(middleware.RequestID())
	e.Use(middleware.TimeoutWithConfig(middleware.TimeoutConfig{
		Skipper:      middleware.DefaultSkipper,
		ErrorMessage: "request timeout",
		Timeout:      30 * time.Second,
	}))

	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)

	s := &Server{
		e:        e,
		cfg:      cfg,
		store:    store,
		analyzer: an,
		addr:     addr,
	}

	s.routes()
	return s
}

func (s *Server) routes() {
	api := s.e.Group("/api/v1")

	api.GET("/health", s.handleHealth)
	api.GET("/stats", s.handleStats)
	api.GET("/repos", s.handleRepos)
	api.GET("/repos/:name", s.handleRepoDetail)
	api.GET("/repos/:name/commits", s.handleRepoCommits)
	api.GET("/repos/:name/contributors", s.handleRepoContributors)
	api.GET("/repos/:name/files", s.handleRepoFiles)
	api.GET("/repos/:name/heatmap", s.handleRepoHeatmap)
	api.GET("/repos/:name/techdebt", s.handleRepoTechDebt)
	api.GET("/alerts", s.handleAlerts)
	api.POST("/alerts/:id/resolve", s.handleResolveAlert)
	api.GET("/contributors/ranking", s.handleContributorRanking)

	s.e.Static("/static", "web/static")
	s.e.GET("/", s.handleDashboard)
	s.e.GET("/repos/:name", s.handleDashboard)
}

func (s *Server) Start(ctx context.Context) error {
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		s.e.Shutdown(shutdownCtx)
	}()

	return s.e.Start(s.addr)
}

func (s *Server) GetAddr() string {
	return s.addr
}

func (s *Server) handleHealth(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().UTC(),
		"version":   "1.0.0",
	})
}

func (s *Server) handleStats(c echo.Context) error {
	stats, err := s.analyzer.GetAllStats()
	if err != nil {
		return s.error(c, http.StatusInternalServerError, err)
	}

	filtered := s.applyJQFilter(c, stats)
	return s.success(c, filtered)
}

func (s *Server) handleRepos(c echo.Context) error {
	repos, err := s.store.GetAllRepos()
	if err != nil {
		return s.error(c, http.StatusInternalServerError, err)
	}

	filtered := s.applyJQFilter(c, repos)
	return s.success(c, filtered)
}

func (s *Server) handleRepoDetail(c echo.Context) error {
	name := c.Param("name")
	repo, err := s.store.GetRepo(name)
	if err != nil {
		return s.error(c, http.StatusInternalServerError, err)
	}
	if repo == nil {
		return s.error(c, http.StatusNotFound, fmt.Errorf("repo not found: %s", name))
	}

	stats, err := s.analyzer.GetStats(name)
	if err != nil {
		return s.error(c, http.StatusInternalServerError, err)
	}

	return s.success(c, map[string]interface{}{
		"repo":  repo,
		"stats": stats,
	})
}

func (s *Server) handleRepoCommits(c echo.Context) error {
	name := c.Param("name")
	limit := queryInt(c, "limit", 100)
	search := c.QueryParam("q")

	var commits []storage.CommitRecord
	var err error

	if search != "" {
		commits, err = s.store.SearchCommits(name, search, limit)
	} else {
		commits, err = s.store.GetCommitsByRepo(name, limit)
	}

	if err != nil {
		return s.error(c, http.StatusInternalServerError, err)
	}

	filtered := s.applyJQFilter(c, commits)
	return s.success(c, filtered)
}

func (s *Server) handleRepoContributors(c echo.Context) error {
	name := c.Param("name")
	contributors, err := s.store.GetContributorsByRepo(name)
	if err != nil {
		return s.error(c, http.StatusInternalServerError, err)
	}

	filtered := s.applyJQFilter(c, contributors)
	return s.success(c, filtered)
}

func (s *Server) handleRepoFiles(c echo.Context) error {
	name := c.Param("name")
	limit := queryInt(c, "limit", 50)

	files, err := s.store.GetTopFilesByChurn(name, limit)
	if err != nil {
		return s.error(c, http.StatusInternalServerError, err)
	}

	filtered := s.applyJQFilter(c, files)
	return s.success(c, filtered)
}

func (s *Server) handleRepoHeatmap(c echo.Context) error {
	name := c.Param("name")
	days := queryInt(c, "days", 90)
	since := time.Now().AddDate(0, 0, -days)

	data, err := s.store.GetHeatmapData(name, since)
	if err != nil {
		return s.error(c, http.StatusInternalServerError, err)
	}

	return s.success(c, data)
}

func (s *Server) handleRepoTechDebt(c echo.Context) error {
	name := c.Param("name")
	items, err := s.store.GetTechDebtByRepo(name)
	if err != nil {
		return s.error(c, http.StatusInternalServerError, err)
	}

	filtered := s.applyJQFilter(c, items)
	return s.success(c, filtered)
}

func (s *Server) handleAlerts(c echo.Context) error {
	alerts, err := s.analyzer.GetAllAlerts()
	if err != nil {
		return s.error(c, http.StatusInternalServerError, err)
	}

	level := c.QueryParam("level")
	if level != "" {
		var filtered []storage.AlertRecord
		for _, a := range alerts {
			if a.Level == level {
				filtered = append(filtered, a)
			}
		}
		alerts = filtered
	}

	filtered := s.applyJQFilter(c, alerts)
	return s.success(c, filtered)
}

func (s *Server) handleResolveAlert(c echo.Context) error {
	id := c.Param("id")
	if err := s.analyzer.ResolveAlert(id); err != nil {
		return s.error(c, http.StatusInternalServerError, err)
	}
	return s.success(c, map[string]string{"status": "resolved"})
}

func (s *Server) handleContributorRanking(c echo.Context) error {
	repos, err := s.store.GetAllRepos()
	if err != nil {
		return s.error(c, http.StatusInternalServerError, err)
	}

	type Ranking struct {
		Name         string `json:"name"`
		Email        string `json:"email"`
		TotalCommits int    `json:"total_commits"`
		Repos        int    `json:"repos"`
		LinesAdded   int    `json:"lines_added"`
		LinesDeleted int    `json:"lines_deleted"`
	}

	contribMap := make(map[string]*Ranking)

	for _, repo := range repos {
		contributors, err := s.store.GetContributorsByRepo(repo.Name)
		if err != nil {
			continue
		}

		for _, c := range contributors {
			key := c.Email
			if key == "" {
				key = c.Name
			}
			if contribMap[key] == nil {
				contribMap[key] = &Ranking{
					Name:  c.Name,
					Email: c.Email,
				}
			}
			contribMap[key].TotalCommits += c.Commits
			contribMap[key].Repos++
			contribMap[key].LinesAdded += c.LinesAdded
			contribMap[key].LinesDeleted += c.LinesDeleted
		}
	}

	rankings := make([]Ranking, 0, len(contribMap))
	for _, r := range contribMap {
		rankings = append(rankings, *r)
	}

	sort.Slice(rankings, func(i, j int) bool {
		return rankings[i].TotalCommits > rankings[j].TotalCommits
	})

	limit := queryInt(c, "limit", 20)
	if limit > 0 && limit < len(rankings) {
		rankings = rankings[:limit]
	}

	filtered := s.applyJQFilter(c, rankings)
	return s.success(c, filtered)
}

func (s *Server) handleDashboard(c echo.Context) error {
	return c.File("web/views/dashboard.html")
}

func (s *Server) success(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    data,
	})
}

func (s *Server) error(c echo.Context, code int, err error) error {
	return c.JSON(code, APIResponse{
		Success: false,
		Error:   err.Error(),
	})
}

func queryInt(c echo.Context, name string, defaultValue int) int {
	val := c.QueryParam(name)
	if val == "" {
		return defaultValue
	}
	var result int
	fmt.Sscanf(val, "%d", &result)
	return result
}

func (s *Server) applyJQFilter(c echo.Context, data interface{}) interface{} {
	filter := c.QueryParam("filter")
	if filter == "" {
		return data
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return data
	}

	var obj interface{}
	if err := json.Unmarshal(jsonData, &obj); err != nil {
		return data
	}

	filtered := applyFilter(obj, filter)
	if filtered != nil {
		return filtered
	}
	return data
}

func applyFilter(data interface{}, filter string) interface{} {
	parts := strings.Split(filter, ".")
	current := data

	for _, part := range parts {
		if part == "" {
			continue
		}

		switch v := current.(type) {
		case map[string]interface{}:
			if val, ok := v[part]; ok {
				current = val
			} else {
				return nil
			}
		case []interface{}:
			var filtered []interface{}
			for _, item := range v {
				if itemMap, ok := item.(map[string]interface{}); ok {
					if val, ok := itemMap[part]; ok {
						filtered = append(filtered, val)
					}
				}
			}
			current = filtered
		default:
			return nil
		}
	}

	return current
}

func BuildCharts(stats []storage.RepoStats, alerts []storage.AlertRecord) map[string]interface{} {
	good := 0
	warning := 0
	critical := 0

	for _, s := range stats {
		switch s.HealthLevel {
		case git.HealthGood:
			good++
		case git.HealthWarning:
			warning++
		case git.HealthCritical:
			critical++
		}
	}

	healthData := []map[string]interface{}{
		{"name": "Good", "value": good, "color": "#10b981"},
		{"name": "Warning", "value": warning, "color": "#f59e0b"},
		{"name": "Critical", "value": critical, "color": "#ef4444"},
	}

	typeMap := make(map[string]int)
	for _, a := range alerts {
		typeMap[a.Type]++
	}

	var alertTypes []map[string]interface{}
	for t, c := range typeMap {
		alertTypes = append(alertTypes, map[string]interface{}{
			"name":  t,
			"value": c,
		})
	}

	return map[string]interface{}{
		"health":     healthData,
		"alertTypes": alertTypes,
		"totalRepos": len(stats),
		"good":       good,
		"warning":    warning,
		"critical":   critical,
		"alerts":     len(alerts),
	}
}
