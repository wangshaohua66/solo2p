package api

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"pavement/internal/engine"
	pverrors "pavement/internal/errors"
	"pavement/internal/storage"
	"pavement/internal/validator"
	"github.com/labstack/echo/v4"
)

type ImportRequest struct {
	DirPath  string `json:"dir_path" form:"dir_path" query:"dir_path"`
	BatchID  string `json:"batch_id" form:"batch_id" query:"batch_id"`
}

type ClassifyRequest struct {
	All         bool    `json:"all" form:"all" query:"all"`
	BatchID     string  `json:"batch_id" form:"batch_id" query:"batch_id"`
	RouteID     string  `json:"route_id" form:"route_id" query:"route_id"`
	IRIWeight   float64 `json:"iri_weight" form:"iri_weight" query:"iri_weight"`
	RutWeight   float64 `json:"rut_weight" form:"rut_weight" query:"rut_weight"`
	CrackWeight float64 `json:"crack_weight" form:"crack_weight" query:"crack_weight"`
}

type BudgetRequest struct {
	TotalBudget    float64 `json:"total_budget" form:"total_budget" query:"total_budget"`
	GradeWeight    float64 `json:"grade_weight" form:"grade_weight" query:"grade_weight"`
	TrafficWeight  float64 `json:"traffic_weight" form:"traffic_weight" query:"traffic_weight"`
	ImportanceWeight float64 `json:"importance_weight" form:"importance_weight" query:"importance_weight"`
	CostWeight     float64 `json:"cost_weight" form:"cost_weight" query:"cost_weight"`
}

type RankRequest struct {
	TopN            int     `json:"top_n" form:"top_n" query:"top_n"`
	GradeWeight     float64 `json:"grade_weight" form:"grade_weight" query:"grade_weight"`
	TrafficWeight   float64 `json:"traffic_weight" form:"traffic_weight" query:"traffic_weight"`
	ImportanceWeight float64 `json:"importance_weight" form:"importance_weight" query:"importance_weight"`
	CostWeight      float64 `json:"cost_weight" form:"cost_weight" query:"cost_weight"`
}

type ImportResponse struct {
	TotalFiles      int      `json:"total_files"`
	SuccessFiles    int      `json:"success_files"`
	FailedFiles     int      `json:"failed_files"`
	TotalRecords    int      `json:"total_records"`
	SuccessRecords  int      `json:"success_records"`
	FailedRecords   int      `json:"failed_records"`
	SuccessRate     float64  `json:"success_rate"`
	BatchIDs        []string `json:"batch_ids"`
	Duration        string   `json:"duration"`
}

type ClassifyResponse struct {
	TotalRecords    int            `json:"total_records"`
	SuccessCount    int            `json:"success_count"`
	FailedCount     int            `json:"failed_count"`
	UpdatedCount    int            `json:"updated_count"`
	Duration        string         `json:"duration"`
	AvgPerRecord    string         `json:"avg_per_record"`
	GradeDistribution map[string]int `json:"grade_distribution"`
}

func (s *Server) handleImport(c echo.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var req ImportRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, 4001, fmt.Sprintf("请求参数解析失败: %v", err))
	}

	if err := validator.ValidateImportPath(req.DirPath); err != nil {
		return errorResponse(c, http.StatusBadRequest, 4002, err.Error())
	}

	startTime := time.Now()

	result, err := s.parser.ImportFromDir(req.DirPath)
	if err != nil {
		return errorResponse(c, http.StatusUnprocessableEntity, 4221, err.Error())
	}

	records := s.parser.GetParsedRecords(result)

	if req.BatchID != "" {
		upperBatch := strings.ToUpper(req.BatchID)
		for _, r := range records {
			r.BatchID = upperBatch
		}
		result.SuccessBatchIDs = []string{strings.ToUpper(req.BatchID)}
	}

	inserted, err := s.db.BatchInsertRecords(records)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, 5003, err.Error())
	}

	elapsed := time.Since(startTime)
	successRate := 0.0
	if result.TotalRecords > 0 {
		successRate = float64(result.SuccessRecords) / float64(result.TotalRecords) * 100
	}

	resp := ImportResponse{
		TotalFiles:     result.TotalFiles,
		SuccessFiles:   result.SuccessFiles,
		FailedFiles:    result.FailedFiles,
		TotalRecords:   result.TotalRecords,
		SuccessRecords: inserted,
		FailedRecords:  result.FailedRecords,
		SuccessRate:    successRate,
		BatchIDs:       result.SuccessBatchIDs,
		Duration:       elapsed.Round(time.Millisecond).String(),
	}

	return successResponse(c, http.StatusOK, fmt.Sprintf("成功导入 %d 条记录", inserted), resp)
}

func (s *Server) handleClassify(c echo.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var req ClassifyRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, 4003, fmt.Sprintf("请求参数解析失败: %v", err))
	}

	if !req.All && req.BatchID == "" && req.RouteID == "" {
		return errorResponse(c, http.StatusBadRequest, 4004, "请指定 all=true 或 batch_id 或 route_id")
	}

	if req.IRIWeight > 0 || req.RutWeight > 0 || req.CrackWeight > 0 {
		iriW := req.IRIWeight
		rutW := req.RutWeight
		crackW := req.CrackWeight
		if iriW == 0 {
			iriW = 0.40
		}
		if rutW == 0 {
			rutW = 0.30
		}
		if crackW == 0 {
			crackW = 0.30
		}
		if err := s.classifier.SetCustomWeights(iriW, rutW, crackW); err != nil {
			return errorResponse(c, http.StatusBadRequest, 4005, err.Error())
		}
	}

	cond := &storage.QueryCondition{}
	if req.RouteID != "" {
		cond.RouteID = strings.ToUpper(req.RouteID)
	}
	cond.Limit = 0

	records, err := s.db.QueryRecords(cond)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, 5004, err.Error())
	}

	needClassify := records
	if !req.All {
		needClassify = make([]*storage.PavementRecord, 0)
		for _, r := range records {
			if r.IRIScore == 0 || r.DiseaseGrade == "中" {
				needClassify = append(needClassify, r)
			}
		}
	}

	if len(needClassify) == 0 {
		return successResponse(c, http.StatusOK, "没有需要判定的记录", ClassifyResponse{
			TotalRecords: 0,
			GradeDistribution: map[string]int{},
		})
	}

	startTime := time.Now()
	success, failed := s.classifier.BatchClassify(needClassify)

	updateCount := 0
	for _, r := range needClassify {
		err := s.db.UpdateRecordClassify(r.ID, r.IRIScore, r.RutScore, r.CrackScore, r.TotalScore, r.DiseaseGrade)
		if err == nil {
			updateCount++
		}
	}

	elapsed := time.Since(startTime)
	avgPerRecord := time.Duration(0)
	if len(needClassify) > 0 {
		avgPerRecord = elapsed / time.Duration(len(needClassify))
	}

	gradeStats := map[string]int{"优": 0, "良": 0, "中": 0, "差": 0}
	for _, r := range needClassify {
		gradeStats[r.DiseaseGrade]++
	}

	resp := ClassifyResponse{
		TotalRecords:      len(needClassify),
		SuccessCount:      success,
		FailedCount:       failed,
		UpdatedCount:      updateCount,
		Duration:          elapsed.Round(time.Millisecond).String(),
		AvgPerRecord:      avgPerRecord.Round(time.Microsecond).String(),
		GradeDistribution: gradeStats,
	}

	return successResponse(c, http.StatusOK, fmt.Sprintf("判定完成，成功 %d 条", success), resp)
}

func (s *Server) handleQuery(c echo.Context) error {
	routeID := c.QueryParam("route_id")
	startStation := c.QueryParam("start_station")
	endStation := c.QueryParam("end_station")
	grade := c.QueryParam("grade")
	startDate := c.QueryParam("start_date")
	endDate := c.QueryParam("end_date")
	limitStr := c.QueryParam("limit")

	params := &validator.QueryParams{
		RouteID:      strings.ToUpper(routeID),
		StartStation: startStation,
		EndStation:   endStation,
		Grade:        validator.NormalizeGrade(grade),
		StartDate:    startDate,
		EndDate:      endDate,
	}

	if err := validator.ValidateQueryParams(params); err != nil {
		return errorResponse(c, http.StatusBadRequest, 4006, err.Error())
	}

	limit := 500
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	cond := &storage.QueryCondition{
		RouteID: params.RouteID,
		Grade:   params.Grade,
		Limit:   limit,
	}

	if params.StartStation != "" {
		st, err := validator.ParseStationToMeters(params.StartStation)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, 4007, err.Error())
		}
		cond.StartStation = &st
	}
	if params.EndStation != "" {
		ed, err := validator.ParseStationToMeters(params.EndStation)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, 4008, err.Error())
		}
		cond.EndStation = &ed
	}
	if params.StartDate != "" {
		sd, err := validator.ParseDate(params.StartDate)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, 4009, err.Error())
		}
		cond.StartDate = &sd
	}
	if params.EndDate != "" {
		ed, err := validator.ParseDate(params.EndDate)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, 4010, err.Error())
		}
		cond.EndDate = &ed
	}

	records, err := s.db.QueryRecords(cond)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, 5005, err.Error())
	}

	if len(records) == 0 {
		return successResponse(c, http.StatusOK, "没有找到符合条件的记录", []interface{}{})
	}

	return successResponse(c, http.StatusOK, fmt.Sprintf("查询到 %d 条记录", len(records)), records)
}

func (s *Server) handleRank(c echo.Context) error {
	var req RankRequest
	if err := c.Bind(&req); err != nil {
		req.TopN = 50
	}

	topN := req.TopN
	if topN <= 0 {
		topN = 50
	}

	if req.GradeWeight > 0 || req.TrafficWeight > 0 || req.ImportanceWeight > 0 || req.CostWeight > 0 {
		gW := req.GradeWeight
		tW := req.TrafficWeight
		iW := req.ImportanceWeight
		cW := req.CostWeight
		if gW == 0 {
			gW = engine.DefaultGradeWeight
		}
		if tW == 0 {
			tW = engine.DefaultTrafficWeight
		}
		if iW == 0 {
			iW = engine.DefaultImportanceWeight
		}
		if cW == 0 {
			cW = engine.DefaultCostWeight
		}
		if err := s.sorter.SetWeights(gW, tW, iW, cW); err != nil {
			return errorResponse(c, http.StatusBadRequest, 4011, err.Error())
		}
	}

	allRecords, err := s.db.QueryRecords(&storage.QueryCondition{Limit: 0})
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, 5006, err.Error())
	}

	if len(allRecords) == 0 {
		return errorResponse(c, http.StatusNotFound, 4012, "数据库中没有记录，请先导入数据")
	}

	needCalc := make([]*storage.PavementRecord, 0)
	for _, r := range allRecords {
		if r.PriorityScore == 0 || r.EstimatedCost == 0 {
			needCalc = append(needCalc, r)
		}
	}

	if len(needCalc) > 0 {
		s.sorter.BatchCalculate(needCalc)
		for _, r := range needCalc {
			s.db.UpdatePriorityAndCost(r.ID, r.PriorityScore, r.EstimatedCost)
		}
	}

	topRecords, err := s.db.GetTopPriorityRecords(topN)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, 5007, err.Error())
	}

	results := s.sorter.SortByPriority(topRecords, topN)

	totalCost := 0.0
	for _, pr := range results {
		totalCost += pr.EstimatedCost
	}

	resp := map[string]interface{}{
		"top_n":       len(results),
		"total_count": len(allRecords),
		"total_cost":  totalCost,
		"records":     results,
	}

	return successResponse(c, http.StatusOK, fmt.Sprintf("返回 Top %d 优先级路段", len(results)), resp)
}

func (s *Server) handleBudget(c echo.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var req BudgetRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, 4013, fmt.Sprintf("请求参数解析失败: %v", err))
	}

	if err := validator.ValidateBudget(req.TotalBudget); err != nil {
		return errorResponse(c, http.StatusBadRequest, 4014, err.Error())
	}
	if req.TotalBudget == 0 {
		return errorResponse(c, http.StatusBadRequest, 4015, "total_budget 不能为空或0")
	}

	if req.GradeWeight > 0 || req.TrafficWeight > 0 || req.ImportanceWeight > 0 || req.CostWeight > 0 {
		gW := req.GradeWeight
		tW := req.TrafficWeight
		iW := req.ImportanceWeight
		cW := req.CostWeight
		if gW == 0 {
			gW = engine.DefaultGradeWeight
		}
		if tW == 0 {
			tW = engine.DefaultTrafficWeight
		}
		if iW == 0 {
			iW = engine.DefaultImportanceWeight
		}
		if cW == 0 {
			cW = engine.DefaultCostWeight
		}
		if err := s.sorter.SetWeights(gW, tW, iW, cW); err != nil {
			return errorResponse(c, http.StatusBadRequest, 4016, err.Error())
		}
	}

	allRecords, err := s.db.QueryRecords(&storage.QueryCondition{Limit: 0})
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, 5008, err.Error())
	}

	if len(allRecords) == 0 {
		return errorResponse(c, http.StatusNotFound, 4017, "数据库中没有记录")
	}

	for _, r := range allRecords {
		if r.PriorityScore == 0 {
			s.sorter.CalculatePriority(r)
			s.db.UpdatePriorityAndCost(r.ID, r.PriorityScore, r.EstimatedCost)
		}
	}

	plan, err := s.sorter.AllocateBudget(allRecords, req.TotalBudget)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, 5009, err.Error())
	}

	return successResponse(c, http.StatusOK, "预算分配方案计算完成", plan)
}

func (s *Server) handleStats(c echo.Context) error {
	dimension := c.QueryParam("dim")
	if dimension == "" {
		dimension = "all"
	}

	dim := strings.ToLower(dimension)
	var statsByRoute, statsByCenter, statsByGrade []*storage.StatisticsResult
	var err error

	if dim == "route" || dim == "all" {
		statsByRoute, err = s.db.GetStatisticsByRoute()
		if err != nil {
			return errorResponse(c, http.StatusInternalServerError, 5010, err.Error())
		}
	}
	if dim == "center" || dim == "all" {
		statsByCenter, err = s.db.GetStatisticsByCenter()
		if err != nil {
			return errorResponse(c, http.StatusInternalServerError, 5011, err.Error())
		}
	}
	if dim == "grade" || dim == "all" {
		statsByGrade, err = s.db.GetStatisticsByGrade()
		if err != nil {
			return errorResponse(c, http.StatusInternalServerError, 5012, err.Error())
		}
	}

	totalRecords, _ := s.db.GetAllRecordsCount()
	totalMileage, _ := s.db.GetTotalMileage()

	resp := map[string]interface{}{
		"dimension":     dim,
		"total_records": totalRecords,
		"total_mileage": totalMileage,
		"by_route":      statsByRoute,
		"by_center":     statsByCenter,
		"by_grade":      statsByGrade,
	}

	return successResponse(c, http.StatusOK, "数据统计完成", resp)
}

func (s *Server) handleExport(c echo.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	outputPath := c.QueryParam("output")
	if outputPath == "" {
		outputPath = filepath.Join(os.TempDir(),
			fmt.Sprintf("maintenance_report_%s.md", time.Now().Format("20060102_150405")))
	}
	outputPath = filepath.Clean(outputPath)

	topNStr := c.QueryParam("top")
	topN := 50
	if topNStr != "" {
		if n, err := strconv.Atoi(topNStr); err == nil && n > 0 {
			topN = n
		}
	}

	budgetStr := c.QueryParam("total_budget")
	var totalBudget float64
	if budgetStr != "" {
		if v, err := strconv.ParseFloat(budgetStr, 64); err == nil {
			totalBudget = v
		}
	}

	records, err := s.db.QueryRecords(&storage.QueryCondition{Limit: 0})
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, 5013, err.Error())
	}

	if len(records) == 0 {
		return errorResponse(c, http.StatusNotFound, 4018, "没有可导出的记录数据")
	}

	statsByRoute, _ := s.db.GetStatisticsByRoute()
	statsByCenter, _ := s.db.GetStatisticsByCenter()
	statsByGrade, _ := s.db.GetStatisticsByGrade()

	topRecords, _ := s.db.GetTopPriorityRecords(topN)
	for _, r := range topRecords {
		if r.PriorityScore == 0 {
			s.sorter.CalculatePriority(r)
		}
	}
	priorityResults := s.sorter.SortByPriority(topRecords, topN)

	var budgetPlan *engine.BudgetPlan
	if totalBudget > 0 {
		for _, r := range records {
			if r.PriorityScore == 0 {
				s.sorter.CalculatePriority(r)
			}
		}
		budgetPlan, _ = s.sorter.AllocateBudget(records, totalBudget)
	}

	savedPath, err := s.reporter.GenerateMaintenanceReport(
		records, budgetPlan,
		statsByRoute, statsByCenter, statsByGrade,
		priorityResults, outputPath,
	)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, 5014, err.Error())
	}

	absPath, _ := filepath.Abs(savedPath)
	fileSize := int64(0)
	if info, err := os.Stat(savedPath); err == nil {
		fileSize = info.Size()
	}

	resp := map[string]interface{}{
		"file_path": absPath,
		"file_size": fileSize,
		"records":   len(records),
		"top_n":     len(priorityResults),
		"has_budget": budgetPlan != nil,
	}

	return successResponse(c, http.StatusOK, "报告导出成功", resp)
}

func (s *Server) handleDelete(c echo.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	batchID := c.QueryParam("batch_id")
	startDate := c.QueryParam("start_date")
	endDate := c.QueryParam("end_date")
	confirm := c.QueryParam("confirm")

	params := &validator.DeleteParams{
		BatchID:   strings.ToUpper(batchID),
		StartDate: startDate,
		EndDate:   endDate,
	}

	if err := validator.ValidateDeleteParams(params); err != nil {
		return errorResponse(c, http.StatusBadRequest, 4019, err.Error())
	}

	if confirm != "yes" && confirm != "true" {
		return errorResponse(c, http.StatusForbidden, 4020, "请添加 confirm=yes 参数确认删除操作")
	}

	totalBefore, _ := s.db.GetAllRecordsCount()
	deletedCount := int64(0)

	if params.BatchID != "" {
		n, err := s.db.DeleteByBatchID(params.BatchID)
		if err != nil {
			return errorResponse(c, http.StatusInternalServerError, 5015, err.Error())
		}
		deletedCount = n
	}

	if params.StartDate != "" && params.EndDate != "" {
		sd, err := validator.ParseDate(params.StartDate)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, 4021, err.Error())
		}
		ed, err := validator.ParseDate(params.EndDate)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, 4022, err.Error())
		}
		n, err := s.db.DeleteByDateRange(sd, ed)
		if err != nil {
			return errorResponse(c, http.StatusInternalServerError, 5016, err.Error())
		}
		deletedCount += n
	}

	totalAfter, _ := s.db.GetAllRecordsCount()

	resp := map[string]interface{}{
		"before_count": totalBefore,
		"deleted_count": deletedCount,
		"after_count":  totalAfter,
	}

	return successResponse(c, http.StatusOK, fmt.Sprintf("成功删除 %d 条记录", deletedCount), resp)
}

var _ pverrors.ErrorCode
