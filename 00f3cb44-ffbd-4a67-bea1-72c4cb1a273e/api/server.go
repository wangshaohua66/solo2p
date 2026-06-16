package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/rs/zerolog/log"

	"crossborder-scraper/pipeline"
)

type Server struct {
	store      *pipeline.Store
	reportsDir string
	httpServer *http.Server
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func NewServer(store *pipeline.Store, dbPath string, port int) *Server {
	reportsDir := filepath.Join(filepath.Dir(dbPath), "reports")
	return &Server{
		store:      store,
		reportsDir: reportsDir,
		httpServer: &http.Server{
			Addr:         fmt.Sprintf(":%d", port),
			ReadTimeout:  30 * time.Second,
			WriteTimeout: 30 * time.Second,
		},
	}
}

func (s *Server) Start(ctx context.Context) error {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/reports", s.handleReports)
	mux.HandleFunc("/api/reports/recent", s.handleRecentReports)
	mux.HandleFunc("/api/reports/", s.handleReportByID)
	mux.HandleFunc("/api/reports/export", s.handleExportReports)
	mux.HandleFunc("/api/health", s.handleHealth)

	s.httpServer.Handler = mux

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.httpServer.Shutdown(shutdownCtx); err != nil {
			log.Error().Err(err).Msg("API server shutdown failed")
		}
	}()

	log.Info().Str("addr", s.httpServer.Addr).Msg("API server starting")
	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("API server error: %w", err)
	}
	return nil
}

func (s *Server) writeJSON(w http.ResponseWriter, status int, resp APIResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    map[string]string{"status": "ok", "timestamp": time.Now().Format(time.RFC3339)},
	})
}

func (s *Server) handleReports(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{
			Success: false,
			Error:   "method not allowed",
		})
		return
	}

	startStr := r.URL.Query().Get("start")
	endStr := r.URL.Query().Get("end")

	var start, end time.Time
	var err error

	if startStr != "" {
		start, err = time.Parse("2006-01-02", startStr)
		if err != nil {
			s.writeJSON(w, http.StatusBadRequest, APIResponse{
				Success: false,
				Error:   "invalid start date, use YYYY-MM-DD format",
			})
			return
		}
		start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	}

	if endStr != "" {
		end, err = time.Parse("2006-01-02", endStr)
		if err != nil {
			s.writeJSON(w, http.StatusBadRequest, APIResponse{
				Success: false,
				Error:   "invalid end date, use YYYY-MM-DD format",
			})
			return
		}
		end = time.Date(end.Year(), end.Month(), end.Day(), 23, 59, 59, 999999999, end.Location())
	}

	reports, err := s.store.QueryReportsByDateRange(start, end)
	if err != nil {
		s.writeJSON(w, http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}
	if reports == nil {
		reports = []*pipeline.TaskReport{}
	}

	s.writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    reports,
	})
}

func (s *Server) handleRecentReports(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{
			Success: false,
			Error:   "method not allowed",
		})
		return
	}

	limit := 20
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	reports, err := s.store.GetRecentReports(limit)
	if err != nil {
		s.writeJSON(w, http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}
	if reports == nil {
		reports = []*pipeline.TaskReport{}
	}

	s.writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    reports,
	})
}

func (s *Server) handleReportByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{
			Success: false,
			Error:   "method not allowed",
		})
		return
	}

	path := r.URL.Path[len("/api/reports/"):]
	if len(path) < 3 || path[:3] != "id/" {
		s.writeJSON(w, http.StatusNotFound, APIResponse{
			Success: false,
			Error:   "not found",
		})
		return
	}

	taskID := path[3:]
	if taskID == "" {
		s.writeJSON(w, http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "task_id is required",
		})
		return
	}

	report, err := s.store.GetTaskReport(taskID)
	if err != nil {
		s.writeJSON(w, http.StatusNotFound, APIResponse{
			Success: false,
			Error:   "report not found",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"report_%s.json\"", taskID))
	json.NewEncoder(w).Encode(report)
}

func (s *Server) handleExportReports(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{
			Success: false,
			Error:   "method not allowed",
		})
		return
	}

	var req struct {
		TaskIDs []string `json:"task_ids"`
		Start   string   `json:"start"`
		End     string   `json:"end"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSON(w, http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "invalid request body",
		})
		return
	}

	var reports []*pipeline.TaskReport
	if len(req.TaskIDs) > 0 {
		for _, id := range req.TaskIDs {
			if r, err := s.store.GetTaskReport(id); err == nil {
				reports = append(reports, r)
			}
		}
	} else {
		var start, end time.Time
		var err error

		if req.Start != "" {
			start, err = time.Parse("2006-01-02", req.Start)
			if err != nil {
				s.writeJSON(w, http.StatusBadRequest, APIResponse{
					Success: false,
					Error:   "invalid start date",
				})
				return
			}
		}
		if req.End != "" {
			end, err = time.Parse("2006-01-02", req.End)
			if err != nil {
				s.writeJSON(w, http.StatusBadRequest, APIResponse{
					Success: false,
					Error:   "invalid end date",
				})
				return
			}
		}

		reports, err = s.store.QueryReportsByDateRange(start, end)
		if err != nil {
			s.writeJSON(w, http.StatusInternalServerError, APIResponse{
				Success: false,
				Error:   err.Error(),
			})
			return
		}
	}

	paths, err := s.store.BatchExportReportsJSON(reports, s.reportsDir)
	if err != nil {
		s.writeJSON(w, http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	s.writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"exported_count": len(paths),
			"files":          paths,
			"output_dir":     s.reportsDir,
		},
	})
}
