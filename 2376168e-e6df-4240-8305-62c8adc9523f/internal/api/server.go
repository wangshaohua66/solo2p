package api

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"gopkg.in/yaml.v3"

	"clear-system/internal/config"
	"clear-system/internal/db"
	"clear-system/internal/model"
	"clear-system/internal/parser"
	"clear-system/internal/reconcile"
	"clear-system/internal/settlement"
)

type ClearTask struct {
	ID        string    `json:"id"`
	BizDate   string    `json:"biz_date"`
	Step      string    `json:"step"`
	Status    string    `json:"status"`
	Progress  int       `json:"progress"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Result    any       `json:"result,omitempty"`
}

type APIServer struct {
	cfg       *config.AppConfig
	db        *db.Database
	engine    *reconcile.RuleEngine
	tasks     map[string]*ClearTask
	tasksMu   sync.RWMutex
	calc      *settlement.NetCalculator
	gen       *settlement.InstructionGenerator
	reportGen *settlement.ReportGenerator
}

func NewAPIServer(cfg *config.AppConfig, database *db.Database) *APIServer {
	return &APIServer{
		cfg:       cfg,
		db:        database,
		engine:    reconcile.NewRuleEngine(cfg),
		tasks:     make(map[string]*ClearTask),
		calc:      settlement.NewNetCalculator(cfg),
		gen:       settlement.NewInstructionGenerator(cfg),
		reportGen: settlement.NewReportGenerator("output/reports"),
	}
}

func (s *APIServer) Start(address string) error {
	e := echo.New()
	e.HideBanner = true
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	v1 := e.Group("/api/v1")

	v1.POST("/tasks/parse", s.handleParseTask)
	v1.POST("/tasks/reconcile", s.handleReconcileTask)
	v1.POST("/tasks/settle", s.handleSettleTask)
	v1.POST("/tasks/report", s.handleReportTask)

	v1.GET("/tasks/:id", s.getTaskStatus)
	v1.GET("/tasks", s.listTasks)

	v1.GET("/templates", s.listTemplates)
	v1.GET("/templates/:name", s.getTemplate)
	v1.POST("/templates/:name", s.uploadTemplate)

	v1.GET("/institutions", s.listInstitutions)
	v1.GET("/rules/:instID", s.getMatchRule)

	v1.GET("/flows", s.listFlows)
	v1.GET("/statistics/:bizDate", s.getStatistics)

	fmt.Printf("[API] 清算服务已启动: http://%s\n", address)
	return e.Start(address)
}

type parseRequest struct {
	File     string `json:"file"`
	Format   string `json:"format"`
	Template string `json:"template"`
	BizDate  string `json:"biz_date"`
	SrcInst  string `json:"src_inst"`
	Resume   bool   `json:"resume"`
}

func (s *APIServer) handleParseTask(c echo.Context) error {
	var req parseRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	if req.File == "" || req.Template == "" || req.BizDate == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file/template/biz_date必填"})
	}

	task := s.createTask("parse", req.BizDate)
	go s.runParseTask(task, &req)
	return c.JSON(http.StatusAccepted, task)
}

func (s *APIServer) runParseTask(task *ClearTask, req *parseRequest) {
	defer s.updateTask(task)
	s.updateProgress(task, 10, "加载模板...")

	tmpl, err := parser.LoadTemplate(req.Template)
	if err != nil {
		s.taskError(task, err)
		return
	}
	s.updateProgress(task, 30, "解析文件...")

	fileParser, err := parser.GetParser(tmpl.Format)
	if err != nil {
		s.taskError(task, err)
		return
	}

	opts := []parser.ParseOption{
		parser.WithBatchSize(5000),
	}
	if req.Resume {
		opts = append(opts, parser.WithResume(s.db, req.File))
	}
	if req.SrcInst != "" {
		opts = append(opts, parser.WithDefaultSourceInst(req.SrcInst))
	}
	opts = append(opts, parser.WithBatchCallback(func(flows []model.ClearFlow, startLine int64) error {
		_, err := s.db.InsertFlows(flows)
		return err
	}))
	opts = append(opts, parser.WithProgressCallback(func(currLine, success, failed int64) {
		p := 30 + int(currLine*50/100000)
		if p > 80 {
			p = 80
		}
		s.updateProgress(task, p, fmt.Sprintf("已处理 %d 行(成功%d/失败%d)", currLine, success, failed))
	}))

	result, err := fileParser.Parse(req.File, tmpl, opts...)
	if err != nil {
		s.taskError(task, err)
		return
	}
	s.updateProgress(task, 90, "保存断点...")
	parser.SaveProgress(s.db, req.File, result.LastLine, result.LastOffset)
	s.taskSuccess(task, result)
}

type reconcileRequest struct {
	BizDate string `json:"biz_date"`
	Workers int    `json:"workers"`
	InstID  string `json:"inst_id"`
}

func (s *APIServer) handleReconcileTask(c echo.Context) error {
	var req reconcileRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	if req.BizDate == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "biz_date必填"})
	}
	task := s.createTask("reconcile", req.BizDate)
	go s.runReconcileTask(task, &req)
	return c.JSON(http.StatusAccepted, task)
}

func (s *APIServer) runReconcileTask(task *ClearTask, req *reconcileRequest) {
	defer s.updateTask(task)
	s.updateProgress(task, 20, "加载流水...")
	flows, err := s.db.QueryFlowsByBizDate(req.BizDate)
	if err != nil {
		s.taskError(task, err)
		return
	}
	s.updateProgress(task, 40, fmt.Sprintf("开始对账: %d笔流水", len(flows)))
	matcher := reconcile.NewMatcher(s.engine)
	workers := req.Workers
	if workers <= 0 {
		workers = 4
	}
	result, err := matcher.ReconcileParallel(req.BizDate, flows, workers)
	if err != nil {
		s.taskError(task, err)
		return
	}
	s.updateProgress(task, 80, "写入对账结果并标记异常...")
	if err := s.db.BatchInsertMatchResults(result.MatchedResults); err != nil {
		s.taskError(task, err)
		return
	}
	if err := s.db.BatchInsertUnilateral(result.UnilateralFlows); err != nil {
		s.taskError(task, err)
		return
	}
	if err := s.db.UpdateFlowStatusWithAudit(result.MatchedResults, result.UnilateralFlows, result.MismatchedFlows); err != nil {
		s.taskError(task, err)
		return
	}
	s.taskSuccess(task, result)
}

type settleRequest struct {
	BizDate  string   `json:"biz_date"`
	Cycle    string   `json:"cycle"`
	Currency []string `json:"currency"`
	Export   bool     `json:"export"`
}

func (s *APIServer) handleSettleTask(c echo.Context) error {
	var req settleRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	if req.BizDate == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "biz_date必填"})
	}
	task := s.createTask("settle", req.BizDate)
	go s.runSettleTask(task, &req)
	return c.JSON(http.StatusAccepted, task)
}

func (s *APIServer) runSettleTask(task *ClearTask, req *settleRequest) {
	defer s.updateTask(task)
	s.updateProgress(task, 20, "加载对账结果...")
	matched, err := s.db.QueryMatchedByDate(req.BizDate)
	if err != nil {
		s.taskError(task, err)
		return
	}
	flows, err := s.db.QueryFlowsByBizDate(req.BizDate)
	if err != nil {
		s.taskError(task, err)
		return
	}
	flowMap := make(map[int64]model.ClearFlow)
	for _, f := range flows {
		flowMap[f.ID] = f
	}

	s.updateProgress(task, 40, "计算头寸...")
	positions, total, stats := s.calc.CalculateSimple(req.BizDate, matched, req.Currency, flowMap)
	s.updateProgress(task, 60, fmt.Sprintf("计算完成: %d家机构净额", len(positions)))
	instructions := s.gen.Generate(req.BizDate, positions)
	s.updateProgress(task, 80, "保存清算指令...")
	if err := s.db.BatchInsertPositions(positions); err != nil {
		s.taskError(task, err)
		return
	}
	if err := s.db.BatchInsertInstructions(instructions); err != nil {
		s.taskError(task, err)
		return
	}
	exported := 0
	if req.Export {
		dir := filepath.Join("output", "instructions")
		os.MkdirAll(dir, 0755)
		for i, ins := range instructions {
			pct := 80 + i*15/len(instructions)
			s.updateProgress(task, pct, fmt.Sprintf("导出指令 %d/%d", i+1, len(instructions)))
			fname := fmt.Sprintf("%s_%s.xml", ins.InstructionNo, ins.SettleDate)
			os.WriteFile(filepath.Join(dir, fname), []byte(ins.Content), 0644)
			exported++
		}
	}
	s.taskSuccess(task, map[string]any{
		"positions":    positions,
		"instructions": instructions,
		"total_amount": total,
		"stats":        stats,
		"exported":     exported,
	})
}

type reportRequest struct {
	BizDate string `json:"biz_date"`
	InstID  string `json:"inst_id"`
	BizType string `json:"biz_type"`
}

func (s *APIServer) handleReportTask(c echo.Context) error {
	var req reportRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	if req.BizDate == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "biz_date必填"})
	}
	task := s.createTask("report", req.BizDate)
	go s.runReportTask(task, &req)
	return c.JSON(http.StatusAccepted, task)
}

func (s *APIServer) runReportTask(task *ClearTask, req *reportRequest) {
	defer s.updateTask(task)
	s.updateProgress(task, 20, "加载对账结果...")
	matched, err := s.db.QueryMatchedByDate(req.BizDate)
	if err != nil {
		s.taskError(task, err)
		return
	}
	s.updateProgress(task, 35, "加载头寸...")
	positions, err := s.db.QueryPositionsByDate(req.BizDate)
	if err != nil {
		s.taskError(task, err)
		return
	}
	s.updateProgress(task, 50, "加载异常与指令...")
	unis, err := s.db.QueryUnilateralFlows(req.BizDate)
	if err != nil {
		s.taskError(task, err)
		return
	}
	instructions, err := s.db.QueryInstructionsByDate(req.BizDate)
	if err != nil {
		s.taskError(task, err)
		return
	}
	s.updateProgress(task, 70, "生成报告...")
	data := &settlement.ReportData{
		SettleDate:      req.BizDate,
		AllFlows:        make(map[int64]model.ClearFlow),
		MatchedResults:  matched,
		UnilateralFlows: unis,
		NetPositions:    positions,
		Instructions:    instructions,
		FilterInstID:    req.InstID,
		FilterBizType:   req.BizType,
	}
	path, err := s.reportGen.Generate(data)
	if err != nil {
		s.taskError(task, err)
		return
	}
	s.taskSuccess(task, map[string]string{"file": path})
}

func (s *APIServer) createTask(step, bizDate string) *ClearTask {
	task := &ClearTask{
		ID:        fmt.Sprintf("task_%d_%s_%s", time.Now().UnixNano(), step, bizDate),
		BizDate:   bizDate,
		Step:      step,
		Status:    "running",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	s.tasksMu.Lock()
	s.tasks[task.ID] = task
	s.tasksMu.Unlock()
	return task
}

func (s *APIServer) updateProgress(task *ClearTask, progress int, msg string) {
	task.Progress = progress
	task.Message = msg
	task.UpdatedAt = time.Now()
	s.updateTask(task)
}

func (s *APIServer) taskSuccess(task *ClearTask, result any) {
	task.Status = "success"
	task.Progress = 100
	task.Message = "任务完成"
	task.Result = result
	task.UpdatedAt = time.Now()
}

func (s *APIServer) taskError(task *ClearTask, err error) {
	task.Status = "failed"
	task.Message = err.Error()
	task.UpdatedAt = time.Now()
}

func (s *APIServer) updateTask(task *ClearTask) {
	s.tasksMu.Lock()
	s.tasks[task.ID] = task
	s.tasksMu.Unlock()
}

func (s *APIServer) getTaskStatus(c echo.Context) error {
	id := c.Param("id")
	s.tasksMu.RLock()
	defer s.tasksMu.RUnlock()
	if task, ok := s.tasks[id]; ok {
		return c.JSON(http.StatusOK, task)
	}
	return c.JSON(http.StatusNotFound, map[string]string{"error": "任务不存在"})
}

func (s *APIServer) listTasks(c echo.Context) error {
	bizDate := c.QueryParam("biz_date")
	status := c.QueryParam("status")
	step := c.QueryParam("step")
	s.tasksMu.RLock()
	defer s.tasksMu.RUnlock()
	results := make([]*ClearTask, 0)
	for _, t := range s.tasks {
		if bizDate != "" && t.BizDate != bizDate {
			continue
		}
		if status != "" && t.Status != status {
			continue
		}
		if step != "" && t.Step != step {
			continue
		}
		results = append(results, t)
	}
	return c.JSON(http.StatusOK, results)
}

func (s *APIServer) listTemplates(c echo.Context) error {
	dir := c.QueryParam("dir")
	if dir == "" {
		dir = "templates"
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	list := make([]map[string]string, 0)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := filepath.Ext(e.Name())
		list = append(list, map[string]string{
			"name": e.Name(),
			"type": ext,
			"path": filepath.Join(dir, e.Name()),
		})
	}
	return c.JSON(http.StatusOK, list)
}

func (s *APIServer) getTemplate(c echo.Context) error {
	name := c.Param("name")
	path := filepath.Join("templates", name)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "模板不存在"})
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	var tmpl model.FileTemplate
	if err := yaml.Unmarshal(raw, &tmpl); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, tmpl)
}

type templateRequest struct {
	Format    string           `json:"format"`
	Encoding  string           `json:"encoding"`
	HasHeader bool             `json:"has_header"`
	Fields    []model.FieldDef `json:"fields"`
}

func (s *APIServer) uploadTemplate(c echo.Context) error {
	name := c.Param("name")
	var req templateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	tmpl := model.FileTemplate{
		Format:    req.Format,
		Encoding:  req.Encoding,
		HasHeader: req.HasHeader,
		Fields:    req.Fields,
	}
	raw, err := yaml.Marshal(tmpl)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	os.MkdirAll("templates", 0755)
	path := filepath.Join("templates", name)
	if err := os.WriteFile(path, raw, 0644); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"path": path, "status": "saved"})
}

func (s *APIServer) listInstitutions(c echo.Context) error {
	return c.JSON(http.StatusOK, s.cfg.Institutions)
}

func (s *APIServer) getMatchRule(c echo.Context) error {
	instID := c.Param("instID")
	bizType := c.QueryParam("biz_type")
	rule := s.cfg.GetMatchRule(instID, bizType)
	return c.JSON(http.StatusOK, rule)
}

func (s *APIServer) listFlows(c echo.Context) error {
	date := c.QueryParam("biz_date")
	inst := c.QueryParam("inst_id")
	status := c.QueryParam("status")
	flows, err := s.db.QueryFlowsByBizDate(date)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	filtered := make([]model.ClearFlow, 0)
	for _, f := range flows {
		if inst != "" && f.SrcInstID != inst && f.DstInstID != inst {
			continue
		}
		if status != "" && string(f.Status) != status {
			continue
		}
		filtered = append(filtered, f)
	}
	return c.JSON(http.StatusOK, filtered)
}

func (s *APIServer) getStatistics(c echo.Context) error {
	bizDate := c.Param("bizDate")
	flows, _ := s.db.QueryFlowsByBizDate(bizDate)
	matched, _ := s.db.QueryMatchedByDate(bizDate)
	positions, _ := s.db.QueryPositionsByDate(bizDate)
	instructions, _ := s.db.QueryInstructionsByDate(bizDate)
	abnormal := 0
	for _, f := range flows {
		if f.Status == model.StatusUnilateral {
			abnormal++
		}
	}
	return c.JSON(http.StatusOK, map[string]any{
		"biz_date":      bizDate,
		"total_flows":   len(flows),
		"matched_pairs": len(matched),
		"positions":     len(positions),
		"instructions":  len(instructions),
		"abnormal":      abnormal,
	})
}

func (s *APIServer) Shutdown(ctx context.Context) error {
	return nil
}
