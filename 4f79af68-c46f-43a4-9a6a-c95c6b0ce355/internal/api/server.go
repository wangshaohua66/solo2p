package api

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"pavement/internal/engine"
	"pavement/internal/export"
	"pavement/internal/parser"
	"pavement/internal/storage"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

type Server struct {
	echo      *echo.Echo
	db        *storage.Database
	parser    *parser.CSVParser
	classifier *engine.DiseaseClassifier
	sorter    *engine.PrioritySorter
	reporter  *export.ReportGenerator
	dbPath    string
	mu        sync.Mutex
}

type APIResponse struct {
	Success   bool        `json:"success"`
	Code      int         `json:"code"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp string      `json:"timestamp"`
}

type ServerConfig struct {
	Port           int
	DBPath         string
	EnableCORS     bool
	RequestTimeout time.Duration
}

func NewServer(cfg *ServerConfig) (*Server, error) {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	if cfg.EnableCORS {
		e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
			AllowOrigins:     []string{"*"},
			AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
			AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
			AllowCredentials: true,
		}))
	}

	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())
	e.Use(middleware.GzipWithConfig(middleware.GzipConfig{
		Level: 5,
	}))
	e.Use(middleware.BodyLimit("50M"))

	if cfg.RequestTimeout > 0 {
		e.Use(middleware.TimeoutWithConfig(middleware.TimeoutConfig{
			Timeout: cfg.RequestTimeout,
		}))
	}

	db, err := storage.NewDatabase(cfg.DBPath)
	if err != nil {
		return nil, fmt.Errorf("初始化数据库失败: %w", err)
	}

	s := &Server{
		echo:       e,
		db:         db,
		parser:     parser.NewCSVParser(),
		classifier: engine.NewDiseaseClassifier(),
		sorter:     engine.NewPrioritySorter(),
		reporter:   export.NewReportGenerator(),
		dbPath:     cfg.DBPath,
	}

	s.registerRoutes()
	return s, nil
}

func (s *Server) registerRoutes() {
	api := s.echo.Group("/api/v1")

	api.GET("/health", s.handleHealth)
	api.GET("/info", s.handleInfo)

	api.POST("/import", s.handleImport)
	api.POST("/classify", s.handleClassify)
	api.GET("/records", s.handleQuery)
	api.GET("/rank", s.handleRank)
	api.POST("/budget", s.handleBudget)
	api.GET("/stats", s.handleStats)
	api.GET("/export", s.handleExport)
	api.DELETE("/records", s.handleDelete)

	api.GET("/routes", s.handleListRoutes)
	api.GET("/centers", s.handleListCenters)
}

func (s *Server) Start(port int) error {
	s.echo.Server.Addr = fmt.Sprintf(":%d", port)

	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		s.echo.Shutdown(ctx)
		s.db.Close()
	}()

	return s.echo.StartServer(s.echo.Server)
}

func (s *Server) Shutdown(ctx context.Context) error {
	if err := s.echo.Shutdown(ctx); err != nil {
		return err
	}
	return s.db.Close()
}

func (s *Server) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

func (s *Server) Echo() *echo.Echo {
	return s.echo
}

func (s *Server) DB() *storage.Database {
	return s.db
}

func successResponse(c echo.Context, code int, message string, data interface{}) error {
	return c.JSON(http.StatusOK, APIResponse{
		Success:   true,
		Code:      code,
		Message:   message,
		Data:      data,
		Timestamp: time.Now().Format(time.RFC3339),
	})
}

func errorResponse(c echo.Context, httpStatus int, code int, message string) error {
	return c.JSON(httpStatus, APIResponse{
		Success:   false,
		Code:      code,
		Message:   message,
		Timestamp: time.Now().Format(time.RFC3339),
	})
}

func (s *Server) handleHealth(c echo.Context) error {
	return successResponse(c, http.StatusOK, "服务运行正常", map[string]interface{}{
		"status":  "healthy",
		"version": "1.0.0",
	})
}

func (s *Server) handleInfo(c echo.Context) error {
	return successResponse(c, http.StatusOK, "服务信息", map[string]interface{}{
		"name":         "pavement API",
		"version":      "1.0.0",
		"standard":     s.classifier.GetStandardName(),
		"description":  "国省干线路面病害检测与养护管理系统 API",
		"endpoints": []string{
			"POST /api/v1/import",
			"POST /api/v1/classify",
			"GET  /api/v1/records",
			"GET  /api/v1/rank",
			"POST /api/v1/budget",
			"GET  /api/v1/stats",
			"GET  /api/v1/export",
			"DELETE /api/v1/records",
		},
	})
}

func (s *Server) handleListRoutes(c echo.Context) error {
	stats, err := s.db.GetStatisticsByRoute()
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, 5001, err.Error())
	}
	return successResponse(c, http.StatusOK, "路线列表", stats)
}

func (s *Server) handleListCenters(c echo.Context) error {
	stats, err := s.db.GetStatisticsByCenter()
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, 5002, err.Error())
	}
	return successResponse(c, http.StatusOK, "养护中心列表", stats)
}
