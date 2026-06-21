package handler

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"exam-system/model"
)

type questionCache struct {
	sync.RWMutex
	questions map[uint]map[string]map[int][]*model.Question
	expiry    time.Time
}

var qCache = &questionCache{
	questions: make(map[uint]map[string]map[int][]*model.Question),
}

const cacheTTL = 5 * time.Minute

func getDifficultyLevel(d string) int {
	switch d {
	case "easy":
		return 1
	case "medium":
		return 2
	case "hard":
		return 3
	default:
		return 2
	}
}

func getDifficultyString(d int) string {
	switch d {
	case 1:
		return "easy"
	case 2:
		return "medium"
	case 3:
		return "hard"
	default:
		return "medium"
	}
}

func loadQuestionCache(tradeID uint, level string) error {
	qCache.Lock()
	defer qCache.Unlock()

	if qCache.questions[tradeID] == nil {
		qCache.questions[tradeID] = make(map[string]map[int][]*model.Question)
	}
	if qCache.questions[tradeID][level] != nil && time.Now().Before(qCache.expiry) {
		return nil
	}

	var questions []model.Question
	if err := model.DB.Where("trade_id = ? AND level = ? AND status = 1", tradeID, level).Find(&questions).Error; err != nil {
		return err
	}

	qCache.questions[tradeID][level] = map[int][]*model.Question{
		1: {},
		2: {},
		3: {},
	}

	for i := range questions {
		q := &questions[i]
		dl := getDifficultyLevel(q.Difficulty)
		qCache.questions[tradeID][level][dl] = append(qCache.questions[tradeID][level][dl], q)
	}

	qCache.expiry = time.Now().Add(cacheTTL)
	return nil
}

func randomSelect(pool []*model.Question, count int) ([]*model.Question, error) {
	if count <= 0 || len(pool) == 0 {
		return nil, nil
	}
	if count > len(pool) {
		return nil, fmt.Errorf("insufficient questions: need %d, have %d", count, len(pool))
	}

	selected := make([]*model.Question, count)
	temp := make([]*model.Question, len(pool))
	copy(temp, pool)

	for i := 0; i < count; i++ {
		max := big.NewInt(int64(len(temp) - i))
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			return nil, err
		}
		selected[i] = temp[idx.Int64()]
		temp[idx.Int64()], temp[len(temp)-1-i] = temp[len(temp)-1-i], temp[idx.Int64()]
	}

	return selected, nil
}

func GetQuestionList(c *gin.Context) {
	page, pageSize := GetPageParams(c)

	tradeID, _ := strconv.Atoi(c.Query("tradeId"))
	level := c.Query("level")
	qType := c.Query("type")
	difficulty := c.Query("difficulty")

	query := model.DB.Model(&model.Question{}).Where("status = 1")

	if tradeID > 0 {
		query = query.Where("trade_id = ?", tradeID)
	}
	if level != "" {
		query = query.Where("level = ?", level)
	}
	if qType != "" {
		query = query.Where("type = ?", qType)
	}
	if difficulty != "" {
		query = query.Where("difficulty = ?", difficulty)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询失败")
		return
	}

	var questions []model.Question
	offset := (page - 1) * pageSize
	if err := query.Preload("Trade").Offset(offset).Limit(pageSize).Order("id DESC").Find(&questions).Error; err != nil {
		Error(c, 500, "查询失败")
		return
	}

	PageSuccess(c, questions, total, page, pageSize)
}

type CreateQuestionRequest struct {
	TradeID        uint            `json:"tradeId" binding:"required"`
	Level          string          `json:"level" binding:"required"`
	Type           string          `json:"type" binding:"required,oneof=single multiple judge essay"`
	Content        string          `json:"content" binding:"required"`
	Options        json.RawMessage `json:"options"`
	Answer         string          `json:"answer" binding:"required"`
	Difficulty     int             `json:"difficulty" binding:"min=1,max=3"`
	KnowledgePoints string         `json:"knowledgePoints"`
}

func CreateQuestion(c *gin.Context) {
	var req CreateQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

	var trade model.Trade
	if err := model.DB.First(&trade, req.TradeID).Error; err != nil {
		Error(c, 404, "工种不存在")
		return
	}

	q := model.Question{
		TradeID:    req.TradeID,
		Level:      req.Level,
		LevelCode:  trade.LevelCode,
		Type:       req.Type,
		Difficulty: getDifficultyString(req.Difficulty),
		Knowledge:  req.KnowledgePoints,
		Content:    req.Content,
		Answer:     req.Answer,
		Status:     1,
	}

	if req.Type != "essay" && req.Type != "judge" && len(req.Options) > 0 {
		var opts []string
		if err := json.Unmarshal(req.Options, &opts); err == nil {
			if len(opts) > 0 {
				q.OptionA = opts[0]
			}
			if len(opts) > 1 {
				q.OptionB = opts[1]
			}
			if len(opts) > 2 {
				q.OptionC = opts[2]
			}
			if len(opts) > 3 {
				q.OptionD = opts[3]
			}
		}
	}

	if err := model.DB.Create(&q).Error; err != nil {
		Error(c, 500, "创建失败")
		return
	}

	qCache.Lock()
	delete(qCache.questions, req.TradeID)
	qCache.Unlock()

	Success(c, q)
}

func UpdateQuestion(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		Error(c, 400, "无效的ID")
		return
	}

	var q model.Question
	if err := model.DB.First(&q, id).Error; err != nil {
		Error(c, 404, "题目不存在")
		return
	}

	var req CreateQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

	var trade model.Trade
	if err := model.DB.First(&trade, req.TradeID).Error; err != nil {
		Error(c, 404, "工种不存在")
		return
	}

	q.TradeID = req.TradeID
	q.Level = req.Level
	q.LevelCode = trade.LevelCode
	q.Type = req.Type
	q.Difficulty = getDifficultyString(req.Difficulty)
	q.Knowledge = req.KnowledgePoints
	q.Content = req.Content
	q.Answer = req.Answer
	q.OptionA = ""
	q.OptionB = ""
	q.OptionC = ""
	q.OptionD = ""

	if req.Type != "essay" && req.Type != "judge" && len(req.Options) > 0 {
		var opts []string
		if err := json.Unmarshal(req.Options, &opts); err == nil {
			if len(opts) > 0 {
				q.OptionA = opts[0]
			}
			if len(opts) > 1 {
				q.OptionB = opts[1]
			}
			if len(opts) > 2 {
				q.OptionC = opts[2]
			}
			if len(opts) > 3 {
				q.OptionD = opts[3]
			}
		}
	}

	if err := model.DB.Save(&q).Error; err != nil {
		Error(c, 500, "更新失败")
		return
	}

	qCache.Lock()
	delete(qCache.questions, req.TradeID)
	qCache.Unlock()

	Success(c, q)
}

func DeleteQuestion(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		Error(c, 400, "无效的ID")
		return
	}

	var q model.Question
	if err := model.DB.First(&q, id).Error; err != nil {
		Error(c, 404, "题目不存在")
		return
	}

	q.Status = 0
	if err := model.DB.Save(&q).Error; err != nil {
		Error(c, 500, "删除失败")
		return
	}

	qCache.Lock()
	delete(qCache.questions, q.TradeID)
	qCache.Unlock()

	Success(c, nil)
}

func BatchImportQuestions(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		Error(c, 400, "请上传文件")
		return
	}

	src, err := file.Open()
	if err != nil {
		Error(c, 400, "文件读取失败")
		return
	}
	defer src.Close()

	f, err := excelize.OpenReader(src)
	if err != nil {
		Error(c, 400, "Excel格式错误")
		return
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		Error(c, 400, "Excel文件为空")
		return
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		Error(c, 400, "读取Excel失败")
		return
	}

	if len(rows) < 2 {
		Error(c, 400, "没有数据")
		return
	}

	successCount := 0
	failCount := 0
	tradeMap := make(map[uint]*model.Trade)

	for i := 1; i < len(rows); i++ {
		row := rows[i]
		if len(row) < 8 {
			failCount++
			continue
		}

		tradeID, _ := strconv.ParseUint(strings.TrimSpace(row[0]), 10, 32)
		if tradeID == 0 {
			failCount++
			continue
		}

		trade, ok := tradeMap[uint(tradeID)]
		if !ok {
			var t model.Trade
			if err := model.DB.First(&t, uint(tradeID)).Error; err != nil {
				failCount++
				continue
			}
			trade = &t
			tradeMap[uint(tradeID)] = trade
		}

		diffInt, _ := strconv.Atoi(strings.TrimSpace(row[5]))
		if diffInt < 1 || diffInt > 3 {
			diffInt = 2
		}

		q := model.Question{
			TradeID:    uint(tradeID),
			Level:      strings.TrimSpace(row[1]),
			LevelCode:  trade.LevelCode,
			Type:       strings.TrimSpace(row[2]),
			Content:    strings.TrimSpace(row[3]),
			Answer:     strings.TrimSpace(row[4]),
			Difficulty: getDifficultyString(diffInt),
			Knowledge:  strings.TrimSpace(row[6]),
			Status:     1,
		}

		qType := strings.TrimSpace(row[2])
		if qType != "essay" && qType != "judge" {
			if len(row) > 7 {
				q.OptionA = strings.TrimSpace(row[7])
			}
			if len(row) > 8 {
				q.OptionB = strings.TrimSpace(row[8])
			}
			if len(row) > 9 {
				q.OptionC = strings.TrimSpace(row[9])
			}
			if len(row) > 10 {
				q.OptionD = strings.TrimSpace(row[10])
			}
		}

		if err := model.DB.Create(&q).Error; err != nil {
			failCount++
			continue
		}

		successCount++
	}

	qCache.Lock()
	for tid := range tradeMap {
		delete(qCache.questions, tid)
	}
	qCache.Unlock()

	Success(c, gin.H{
		"success": successCount,
		"fail":    failCount,
	})
}

type GeneratePaperRequest struct {
	TradeID      uint    `json:"tradeId" binding:"required"`
	Level        string  `json:"level" binding:"required"`
	QuestionNum  int     `json:"questionNum" binding:"required,min=1"`
	EasyRatio    float64 `json:"easyRatio"`
	MediumRatio  float64 `json:"mediumRatio"`
	HardRatio    float64 `json:"hardRatio"`
	NeedABPaper  bool    `json:"needABPaper"`
}

type PaperQuestionVO struct {
	ID          uint     `json:"id"`
	Type        string   `json:"type"`
	Content     string   `json:"content"`
	Options     []string `json:"options,omitempty"`
	Score       int      `json:"score"`
	Answer      string   `json:"answer"`
	Knowledge   string   `json:"knowledge,omitempty"`
	Analysis    string   `json:"analysis,omitempty"`
	ScoringRule string   `json:"scoringRule,omitempty"`
	PenaltyRule string   `json:"penaltyRule,omitempty"`
}

type PaperDetailVO struct {
	ID              uint              `json:"id"`
	Name            string            `json:"name"`
	TradeID         uint              `json:"tradeId"`
	Level           string            `json:"level"`
	TotalScore      int               `json:"totalScore"`
	QuestionCount   int               `json:"questionCount"`
	Questions       []PaperQuestionVO `json:"questions"`
	KnowledgeCovered []string          `json:"knowledgeCovered"`
	KnowledgeMissing []string          `json:"knowledgeMissing,omitempty"`
	ScoringStandards string            `json:"scoringStandards,omitempty"`
}

func getScoringRuleForQuestion(q *model.Question, score int) string {
	switch q.Type {
	case "single":
		return fmt.Sprintf("单选题，满分%d分，选择正确答案得全分，选错或不选得0分", score)
	case "multiple":
		return fmt.Sprintf("多选题，满分%d分，全部选对得全分，少选且选对得%d分，选错或多选得0分", score, score/2)
	case "judge":
		return fmt.Sprintf("判断题，满分%d分，判断正确得全分，判断错误或不答得0分", score)
	case "essay":
		return fmt.Sprintf("论述题/简答题，满分%d分。评分要点：(1)核心观点正确得%d分；(2)论述充分条理清晰得%d分；(3)结合实际案例得%d分", score, score/2, score/4, score/4)
	default:
		return fmt.Sprintf("满分%d分，按标准答案评分", score)
	}
}

func getPenaltyRuleForQuestion(q *model.Question) string {
	switch q.Type {
	case "single":
		return "选错、不选、多选均不得分"
	case "multiple":
		return "多选或错选不得分，少选且全部选对得部分分值"
	case "judge":
		return "判断错误不得分，不答按错误处理"
	case "essay":
		return "答案与题目无关或严重偏离主题得0分，存在明显知识性错误酌情扣分"
	default:
		return "不按要求作答酌情扣分"
	}
}

func getGeneralScoringStandards() string {
	return "一、总体原则：试卷总分100分，60分及以上为合格。二、客观题（单选、多选、判断）采用机器阅卷，按标准答案自动评分。三、主观题（简答、论述）采用人工阅卷，按评分细则分步给分。四、缺考考生成绩记为0分。五、违纪考生成绩记为0分并标注违纪。六、成绩保留两位小数，四舍五入。"
}

func extractKnowledgePoints(questions []*model.Question) map[string][]*model.Question {
	kpMap := make(map[string][]*model.Question)
	for _, q := range questions {
		if q.Knowledge != "" {
			kps := strings.Split(q.Knowledge, ",")
			for _, kp := range kps {
				kp = strings.TrimSpace(kp)
				if kp != "" {
					kpMap[kp] = append(kpMap[kp], q)
				}
			}
		} else {
			kpMap["未分类"] = append(kpMap["未分类"], q)
		}
	}
	return kpMap
}

func getAllKnowledgePoints(tradeID uint, level string) []string {
	var questions []model.Question
	model.DB.Where("trade_id = ? AND level = ? AND status = 1 AND knowledge != ''", tradeID, level).Find(&questions)
	kpSet := make(map[string]bool)
	for _, q := range questions {
		kps := strings.Split(q.Knowledge, ",")
		for _, kp := range kps {
			kp = strings.TrimSpace(kp)
			if kp != "" {
				kpSet[kp] = true
			}
		}
	}
	result := make([]string, 0, len(kpSet))
	for kp := range kpSet {
		result = append(result, kp)
	}
	return result
}

func selectByKnowledgeCoverage(pool []*model.Question, count int, allKPs []string) ([]*model.Question, []string, []string, error) {
	if count <= 0 || len(pool) == 0 {
		return nil, nil, nil, nil
	}
	if count > len(pool) {
		return nil, nil, nil, fmt.Errorf("insufficient questions: need %d, have %d", count, len(pool))
	}

	kpMap := extractKnowledgePoints(pool)
	selected := make([]*model.Question, 0, count)
	selectedIDs := make(map[uint]bool)
	coveredKP := make(map[string]bool)

	kpList := make([]string, 0, len(allKPs))
	for _, kp := range allKPs {
		if _, exists := kpMap[kp]; exists {
			kpList = append(kpList, kp)
		}
	}

	for _, kp := range kpList {
		if len(selected) >= count {
			break
		}
		questions := kpMap[kp]
		for _, q := range questions {
			if !selectedIDs[q.ID] {
				selected = append(selected, q)
				selectedIDs[q.ID] = true
				coveredKP[kp] = true
				break
			}
		}
	}

	missingKP := make([]string, 0)
	for _, kp := range allKPs {
		if !coveredKP[kp] {
			missingKP = append(missingKP, kp)
		}
	}

	if len(selected) < count {
		remaining := make([]*model.Question, 0)
		for _, q := range pool {
			if !selectedIDs[q.ID] {
				remaining = append(remaining, q)
			}
		}
		moreNeeded := count - len(selected)
		extra, err := randomSelect(remaining, moreNeeded)
		if err != nil {
			return nil, nil, nil, err
		}
		for _, q := range extra {
			selected = append(selected, q)
			if q.Knowledge != "" {
				kps := strings.Split(q.Knowledge, ",")
				for _, kp := range kps {
					kp = strings.TrimSpace(kp)
					if kp != "" {
						coveredKP[kp] = true
					}
				}
			}
		}
	}

	coveredList := make([]string, 0, len(coveredKP))
	for kp := range coveredKP {
		coveredList = append(coveredList, kp)
	}

	newMissing := make([]string, 0)
	for _, kp := range allKPs {
		if !coveredKP[kp] {
			newMissing = append(newMissing, kp)
		}
	}

	return selected, coveredList, newMissing, nil
}

func GeneratePaper(c *gin.Context) {
	var req GeneratePaperRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

	if req.EasyRatio == 0 && req.MediumRatio == 0 && req.HardRatio == 0 {
		req.EasyRatio = 0.3
		req.MediumRatio = 0.5
		req.HardRatio = 0.2
	}

	totalRatio := req.EasyRatio + req.MediumRatio + req.HardRatio
	if totalRatio <= 0 {
		Error(c, 400, "难度比例总和必须大于0")
		return
	}

	var trade model.Trade
	if err := model.DB.First(&trade, req.TradeID).Error; err != nil {
		Error(c, 404, "工种不存在")
		return
	}

	if err := loadQuestionCache(req.TradeID, req.Level); err != nil {
		Error(c, 500, "加载题库失败")
		return
	}

	qCache.RLock()
	levelCache := qCache.questions[req.TradeID][req.Level]
	qCache.RUnlock()

	if levelCache == nil {
		Error(c, 400, "题库为空")
		return
	}

	easyCount := int(float64(req.QuestionNum) * req.EasyRatio / totalRatio)
	mediumCount := int(float64(req.QuestionNum) * req.MediumRatio / totalRatio)
	hardCount := req.QuestionNum - easyCount - mediumCount

	if hardCount < 0 {
		hardCount = 0
		mediumCount = req.QuestionNum - easyCount
	}

	allKnowledgePoints := getAllKnowledgePoints(req.TradeID, req.Level)

	easyQuestions, easyCovered, easyMissing, err := selectByKnowledgeCoverage(levelCache[1], easyCount, allKnowledgePoints)
	if err != nil {
		Error(c, 400, "简单题数量不足")
		return
	}

	mediumQuestions, mediumCovered, mediumMissing, err := selectByKnowledgeCoverage(levelCache[2], mediumCount, allKnowledgePoints)
	if err != nil {
		Error(c, 400, "中等题数量不足")
		return
	}

	hardQuestions, hardCovered, hardMissing, err := selectByKnowledgeCoverage(levelCache[3], hardCount, allKnowledgePoints)
	if err != nil {
		Error(c, 400, "困难题数量不足")
		return
	}

	allCoveredKP := make(map[string]bool)
	for _, kp := range easyCovered {
		allCoveredKP[kp] = true
	}
	for _, kp := range mediumCovered {
		allCoveredKP[kp] = true
	}
	for _, kp := range hardCovered {
		allCoveredKP[kp] = true
	}

	coveredList := make([]string, 0, len(allCoveredKP))
	for kp := range allCoveredKP {
		coveredList = append(coveredList, kp)
	}

	missingSet := make(map[string]bool)
	for _, kp := range easyMissing {
		missingSet[kp] = true
	}
	for _, kp := range mediumMissing {
		missingSet[kp] = true
	}
	for _, kp := range hardMissing {
		missingSet[kp] = true
	}
	for kp := range allCoveredKP {
		delete(missingSet, kp)
	}
	missingList := make([]string, 0, len(missingSet))
	for kp := range missingSet {
		missingList = append(missingList, kp)
	}

	easyScore := 2
	mediumScore := 3
	hardScore := 5

	totalScore := len(easyQuestions)*easyScore + len(mediumQuestions)*mediumScore + len(hardQuestions)*hardScore
	if totalScore != 100 {
		ratio := float64(100) / float64(totalScore)
		easyScore = int(float64(easyScore) * ratio)
		mediumScore = int(float64(mediumScore) * ratio)
		hardScore = int(float64(hardScore) * ratio)

		totalScore = len(easyQuestions)*easyScore + len(mediumQuestions)*mediumScore + len(hardQuestions)*hardScore
		if totalScore < 100 {
			mediumScore += 100 - totalScore
		}
		if totalScore > 100 {
			mediumScore -= totalScore - 100
		}
	}

	paperVersions := []string{"A"}
	if req.NeedABPaper {
		paperVersions = []string{"A", "B"}
	}

	result := make([]PaperDetailVO, 0, len(paperVersions))

	for _, version := range paperVersions {
		var selectedEasy, selectedMedium, selectedHard []*model.Question

		if version == "A" {
			selectedEasy = easyQuestions
			selectedMedium = mediumQuestions
			selectedHard = hardQuestions
		} else {
			selectedEasy, _ = randomSelect(levelCache[1], easyCount)
			selectedMedium, _ = randomSelect(levelCache[2], mediumCount)
			selectedHard, _ = randomSelect(levelCache[3], hardCount)

			if selectedEasy == nil {
				selectedEasy = easyQuestions
			}
			if selectedMedium == nil {
				selectedMedium = mediumQuestions
			}
			if selectedHard == nil {
				selectedHard = hardQuestions
			}
		}

		paper := model.Paper{
			Name:          fmt.Sprintf("%s-%s-%s卷", trade.Name, req.Level, version),
			TradeID:       req.TradeID,
			Level:         req.Level,
			LevelCode:     trade.LevelCode,
			ExamType:      "theory",
			TotalScore:    100,
			PassingScore:  60,
			Duration:      120,
			QuestionCount: req.QuestionNum,
			Version:       version,
			Status:        1,
		}

		if err := model.DB.Create(&paper).Error; err != nil {
			Error(c, 500, "创建试卷失败")
			return
		}

		allQuestions := make([]*model.Question, 0, req.QuestionNum)
		allScores := make([]int, 0, req.QuestionNum)

		for _, q := range selectedEasy {
			allQuestions = append(allQuestions, q)
			allScores = append(allScores, easyScore)
		}
		for _, q := range selectedMedium {
			allQuestions = append(allQuestions, q)
			allScores = append(allScores, mediumScore)
		}
		for _, q := range selectedHard {
			allQuestions = append(allQuestions, q)
			allScores = append(allScores, hardScore)
		}

		for i := len(allQuestions) - 1; i > 0; i-- {
			max := big.NewInt(int64(i + 1))
			j, _ := rand.Int(rand.Reader, max)
			allQuestions[i], allQuestions[j.Int64()] = allQuestions[j.Int64()], allQuestions[i]
			allScores[i], allScores[j.Int64()] = allScores[j.Int64()], allScores[i]
		}

		vo := PaperDetailVO{
			ID:               paper.ID,
			Name:             paper.Name,
			TradeID:          paper.TradeID,
			Level:            paper.Level,
			TotalScore:       paper.TotalScore,
			QuestionCount:    paper.QuestionCount,
			Questions:        make([]PaperQuestionVO, 0, len(allQuestions)),
			KnowledgeCovered: coveredList,
			KnowledgeMissing: missingList,
			ScoringStandards: getGeneralScoringStandards(),
		}

		for idx, q := range allQuestions {
			pq := model.PaperQuestion{
				PaperID:    paper.ID,
				QuestionID: q.ID,
				Sort:       idx,
				Score:      allScores[idx],
			}
			model.DB.Create(&pq)

			qvo := PaperQuestionVO{
				ID:          q.ID,
				Type:        q.Type,
				Content:     q.Content,
				Score:       allScores[idx],
				Answer:      q.Answer,
				Knowledge:   q.Knowledge,
				Analysis:    q.Analysis,
				ScoringRule: getScoringRuleForQuestion(q, allScores[idx]),
				PenaltyRule: getPenaltyRuleForQuestion(q),
			}

			if q.Type != "essay" && q.Type != "judge" {
				opts := make([]string, 0, 4)
				if q.OptionA != "" {
					opts = append(opts, q.OptionA)
				}
				if q.OptionB != "" {
					opts = append(opts, q.OptionB)
				}
				if q.OptionC != "" {
					opts = append(opts, q.OptionC)
				}
				if q.OptionD != "" {
					opts = append(opts, q.OptionD)
				}
				qvo.Options = opts
			}

			vo.Questions = append(vo.Questions, qvo)
		}

		result = append(result, vo)
	}

	Success(c, result)
}

func GetPaperDetail(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		Error(c, 400, "无效的ID")
		return
	}

	var paper model.Paper
	if err := model.DB.First(&paper, id).Error; err != nil {
		Error(c, 404, "试卷不存在")
		return
	}

	var paperQuestions []model.PaperQuestion
	if err := model.DB.Preload("Question").Where("paper_id = ?", id).Order("sort ASC").Find(&paperQuestions).Error; err != nil {
		Error(c, 500, "查询失败")
		return
	}

	coveredKP := make(map[string]bool)
	for _, pq := range paperQuestions {
		if pq.Question.Knowledge != "" {
			kps := strings.Split(pq.Question.Knowledge, ",")
			for _, kp := range kps {
				kp = strings.TrimSpace(kp)
				if kp != "" {
					coveredKP[kp] = true
				}
			}
		}
	}
	coveredList := make([]string, 0, len(coveredKP))
	for kp := range coveredKP {
		coveredList = append(coveredList, kp)
	}

	vo := PaperDetailVO{
		ID:               paper.ID,
		Name:             paper.Name,
		TradeID:          paper.TradeID,
		Level:            paper.Level,
		TotalScore:       paper.TotalScore,
		QuestionCount:    paper.QuestionCount,
		Questions:        make([]PaperQuestionVO, 0, len(paperQuestions)),
		KnowledgeCovered: coveredList,
		ScoringStandards: getGeneralScoringStandards(),
	}

	for _, pq := range paperQuestions {
		q := pq.Question
		qvo := PaperQuestionVO{
			ID:          q.ID,
			Type:        q.Type,
			Content:     q.Content,
			Score:       pq.Score,
			Answer:      q.Answer,
			Knowledge:   q.Knowledge,
			Analysis:    q.Analysis,
			ScoringRule: getScoringRuleForQuestion(&q, pq.Score),
			PenaltyRule: getPenaltyRuleForQuestion(&q),
		}

		if q.Type != "essay" && q.Type != "judge" {
			opts := make([]string, 0, 4)
			if q.OptionA != "" {
				opts = append(opts, q.OptionA)
			}
			if q.OptionB != "" {
				opts = append(opts, q.OptionB)
			}
			if q.OptionC != "" {
				opts = append(opts, q.OptionC)
			}
			if q.OptionD != "" {
				opts = append(opts, q.OptionD)
			}
			qvo.Options = opts
		}

		vo.Questions = append(vo.Questions, qvo)
	}

	Success(c, vo)
}
