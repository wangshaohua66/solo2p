package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func newTestServer(t *testing.T) (*Server, string) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "api_test.db")
	cfg := &ServerConfig{
		Port:       0,
		DBPath:     dbPath,
		EnableCORS: false,
	}
	server, err := NewServer(cfg)
	if err != nil {
		t.Fatalf("NewServer() error: %v", err)
	}
	t.Cleanup(func() { server.Close() })
	return server, dbPath
}

func TestHandleHealth(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Health status = %d, want %d", rec.Code, http.StatusOK)
	}

	var resp APIResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Response JSON parse error: %v", err)
	}
	if !resp.Success {
		t.Errorf("Health success = %v, want true", resp.Success)
	}
	if resp.Message != "服务运行正常" {
		t.Errorf("Health message = %q, want %q", resp.Message, "服务运行正常")
	}
}

func TestHandleInfo(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/info", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Info status = %d, want %d", rec.Code, http.StatusOK)
	}

	var resp APIResponse
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if !resp.Success {
		t.Errorf("Info success = %v, want true", resp.Success)
	}
}

func TestHandleQuery_EmptyDB(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/records", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Query empty DB status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestHandleStats_EmptyDB(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/stats?dim=all", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Stats status = %d, want %d", rec.Code, http.StatusOK)
	}

	var resp APIResponse
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if !resp.Success {
		t.Errorf("Stats success = %v, want true", resp.Success)
	}
}

func TestHandleRank_EmptyDB(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/rank", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("Rank empty DB status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHandleClassify_MissingParams(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/classify", nil)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Classify missing params status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleDelete_MissingConfirm(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/records?batch_id=Q1-2024", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("Delete missing confirm status = %d, want %d", rec.Code, http.StatusForbidden)
	}
}

func TestHandleImport_InvalidPath(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/import", strings.NewReader(
		`{"dir_path":"/nonexistent"}`,
	))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Import invalid path status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleImport_Success(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	dir := t.TempDir()
	csvContent := `路线编号,起始桩号,终止桩号,平整度,车辙深度,裂缝密度,交通量,重要性,养护中心,检测日期
G108,K0+000,K1+000,1.2,3.0,0.5,30000,3,养护一中心,2024-01-15
`
	csvFile := filepath.Join(dir, "test.csv")
	os.WriteFile(csvFile, []byte(csvContent), 0644)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/import", strings.NewReader(
		fmt.Sprintf(`{"dir_path":"%s","batch_id":"API-TEST-2024"}`, dir),
	))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Import status = %d, want %d, body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var resp APIResponse
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if !resp.Success {
		t.Errorf("Import success = %v, want true", resp.Success)
	}
}

func TestHandleQuery_AfterImport(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	dir := t.TempDir()
	csvContent := `路线编号,起始桩号,终止桩号,平整度,车辙深度,裂缝密度,交通量,重要性,养护中心,检测日期
G108,K0+000,K1+000,1.2,3.0,0.5,30000,3,养护一中心,2024-01-15
S305,K0+000,K1+000,4.0,12.0,10.0,20000,1,养护三中心,2024-01-16
`
	csvFile := filepath.Join(dir, "test.csv")
	os.WriteFile(csvFile, []byte(csvContent), 0644)

	importReq := httptest.NewRequest(http.MethodPost, "/api/v1/import", strings.NewReader(
		fmt.Sprintf(`{"dir_path":"%s","batch_id":"Q1-2024"}`, dir),
	))
	importReq.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	importRec := httptest.NewRecorder()
	e.ServeHTTP(importRec, importReq)

	queryReq := httptest.NewRequest(http.MethodGet, "/api/v1/records?route_id=G108", nil)
	queryRec := httptest.NewRecorder()
	e.ServeHTTP(queryRec, queryReq)

	if queryRec.Code != http.StatusOK {
		t.Errorf("Query after import status = %d, want %d", queryRec.Code, http.StatusOK)
	}

	var resp APIResponse
	json.Unmarshal(queryRec.Body.Bytes(), &resp)
	if !resp.Success {
		t.Errorf("Query success = %v, want true", resp.Success)
	}
}

func TestHandleStats_AfterImport(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	dir := t.TempDir()
	csvContent := `路线编号,起始桩号,终止桩号,平整度,车辙深度,裂缝密度,交通量,重要性,养护中心,检测日期
G108,K0+000,K1+000,1.2,3.0,0.5,30000,3,养护一中心,2024-01-15
`
	csvFile := filepath.Join(dir, "test.csv")
	os.WriteFile(csvFile, []byte(csvContent), 0644)

	importReq := httptest.NewRequest(http.MethodPost, "/api/v1/import", strings.NewReader(
		fmt.Sprintf(`{"dir_path":"%s","batch_id":"Q1-2024"}`, dir),
	))
	importReq.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	importRec := httptest.NewRecorder()
	e.ServeHTTP(importRec, importReq)

	statsReq := httptest.NewRequest(http.MethodGet, "/api/v1/stats?dim=all", nil)
	statsRec := httptest.NewRecorder()
	e.ServeHTTP(statsRec, statsReq)

	if statsRec.Code != http.StatusOK {
		t.Errorf("Stats after import status = %d, want %d", statsRec.Code, http.StatusOK)
	}

	var resp APIResponse
	json.Unmarshal(statsRec.Body.Bytes(), &resp)
	if !resp.Success {
		t.Errorf("Stats success = %v, want true", resp.Success)
	}
}

func TestHandleBudget_MissingBudget(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/budget", nil)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Budget missing amount status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleBudget_NegativeBudget(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/budget?total_budget=-1000", nil)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Budget negative amount status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleListRoutes(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/routes", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("List routes status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestHandleListCenters(t *testing.T) {
	server, _ := newTestServer(t)
	e := server.Echo()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/centers", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("List centers status = %d, want %d", rec.Code, http.StatusOK)
	}
}
