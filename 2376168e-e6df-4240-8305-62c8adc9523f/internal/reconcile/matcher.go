package reconcile

import (
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"

	"clear-system/internal/config"
	"clear-system/internal/model"
)

type Matcher struct {
	engine *RuleEngine
	mu     sync.RWMutex
}

func NewMatcher(engine *RuleEngine) *Matcher {
	return &Matcher{engine: engine}
}

type MatchPair struct {
	Flow1         model.ClearFlow
	Flow2         model.ClearFlow
	Score         int
	AmountDiff    decimal.Decimal
	ToleranceUsed bool
}

type ReconcileResult struct {
	BizDate          string
	TotalFlows       int
	MatchedPairs     int
	UnilateralCount  int
	MismatchCount    int
	TotalTolerance   decimal.Decimal
	MatchedResults   []model.MatchResult
	UnilateralFlows  []model.UnilateralFlow
	MismatchedFlows  []model.ClearFlow
	ProcessingTime   time.Duration
}

type FlowIndex struct {
	byBizNo   map[string][]model.ClearFlow
	byInst    map[string]map[string][]model.ClearFlow
	byDate    map[string][]model.ClearFlow
	mu        sync.RWMutex
}

func NewFlowIndex() *FlowIndex {
	return &FlowIndex{
		byBizNo: make(map[string][]model.ClearFlow),
		byInst:  make(map[string]map[string][]model.ClearFlow),
		byDate:  make(map[string][]model.ClearFlow),
	}
}

func (idx *FlowIndex) Add(flows []model.ClearFlow) {
	idx.mu.Lock()
	defer idx.mu.Unlock()
	for _, f := range flows {
		if f.BizNo != "" {
			idx.byBizNo[f.BizNo] = append(idx.byBizNo[f.BizNo], f)
		}
		key := f.SrcInstID + "|" + f.DstInstID
		if _, ok := idx.byInst[key]; !ok {
			idx.byInst[key] = make(map[string][]model.ClearFlow)
		}
		idx.byInst[key][string(f.BizType)] = append(idx.byInst[key][string(f.BizType)], f)
		idx.byDate[f.BizDate] = append(idx.byDate[f.BizDate], f)
	}
}

func (idx *FlowIndex) FindByBizNo(bizNo string) []model.ClearFlow {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return idx.byBizNo[bizNo]
}

func (idx *FlowIndex) FindByInstPair(srcInst, dstInst, bizType string) []model.ClearFlow {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	key := srcInst + "|" + dstInst
	if m, ok := idx.byInst[key]; ok {
		return m[bizType]
	}
	revKey := dstInst + "|" + srcInst
	if m, ok := idx.byInst[revKey]; ok {
		return m[bizType]
	}
	return nil
}

func (m *Matcher) Reconcile(bizDate string, flows []model.ClearFlow) (*ReconcileResult, error) {
	start := time.Now()
	result := &ReconcileResult{
		BizDate:    bizDate,
		TotalFlows: len(flows),
	}

	if len(flows) == 0 {
		return result, nil
	}

	outFlows, inFlows := splitFlowsByDirection(flows)
	idx := NewFlowIndex()
	idx.Add(inFlows)

	matchedFlowIDs := make(map[int64]bool)
	pairs := make([]MatchPair, 0)

	for _, outFlow := range outFlows {
		if matchedFlowIDs[outFlow.ID] {
			continue
		}
		rule := m.engine.GetRule(outFlow.SrcInstID, outFlow.BizType)
		candidates := m.findCandidates(idx, outFlow)
		bestPair, found := m.findBestMatch(outFlow, candidates, rule, matchedFlowIDs)
		if found {
			pairs = append(pairs, bestPair)
			matchedFlowIDs[outFlow.ID] = true
			matchedFlowIDs[bestPair.Flow2.ID] = true
		}
	}

	for _, p := range pairs {
		mr := model.MatchResult{
			FlowID1:       p.Flow1.ID,
			FlowID2:       p.Flow2.ID,
			MatchScore:    p.Score,
			AmountDiff:    p.AmountDiff,
			MatchType:     "BIDIRECTIONAL",
			ToleranceUsed: p.ToleranceUsed,
			MatchTime:     time.Now(),
			BizDate:       bizDate,
			SrcInstID:     p.Flow1.SrcInstID,
			DstInstID:     p.Flow1.DstInstID,
		}
		result.MatchedResults = append(result.MatchedResults, mr)
		if p.ToleranceUsed {
			result.TotalTolerance = result.TotalTolerance.Add(p.AmountDiff)
		}
	}
	result.MatchedPairs = len(pairs)

	for _, f := range flows {
		if !matchedFlowIDs[f.ID] {
			rule := m.engine.GetRule(f.SrcInstID, f.BizType)
			if rule.AllowOneSided {
				side := string(f.Direction)
				instID := f.SrcInstID
				if f.Direction == model.DirectionIn {
					instID = f.DstInstID
				}
				result.UnilateralFlows = append(result.UnilateralFlows, model.UnilateralFlow{
					FlowID:      f.ID,
					PendingSide: side,
					HangTime:    time.Now(),
					BizDate:     bizDate,
					InstID:      instID,
					Status:      model.StatusUnilateral,
				})
				result.UnilateralCount++
			} else {
				result.MismatchedFlows = append(result.MismatchedFlows, f)
				result.MismatchCount++
			}
		}
	}

	result.ProcessingTime = time.Since(start)
	return result, nil
}

func splitFlowsByDirection(flows []model.ClearFlow) (out, in []model.ClearFlow) {
	for _, f := range flows {
		if f.Direction == model.DirectionOut {
			out = append(out, f)
		} else {
			in = append(in, f)
		}
	}
	return
}

func (m *Matcher) findCandidates(idx *FlowIndex, flow model.ClearFlow) []model.ClearFlow {
	candidates := make([]model.ClearFlow, 0)
	if flow.BizNo != "" {
		candidates = append(candidates, idx.FindByBizNo(flow.BizNo)...)
	}
	instCands := idx.FindByInstPair(flow.SrcInstID, flow.DstInstID, string(flow.BizType))
	candidates = append(candidates, instCands...)
	seen := make(map[int64]bool)
	unique := make([]model.ClearFlow, 0, len(candidates))
	for _, c := range candidates {
		if seen[c.ID] {
			continue
		}
		seen[c.ID] = true
		if c.ID == flow.ID {
			continue
		}
		if c.SrcInstID != flow.DstInstID || c.DstInstID != flow.SrcInstID {
			continue
		}
		if c.BizDate != flow.BizDate {
			continue
		}
		unique = append(unique, c)
	}
	return unique
}

func (m *Matcher) findBestMatch(flow model.ClearFlow, candidates []model.ClearFlow, rule config.MatchRule, used map[int64]bool) (MatchPair, bool) {
	var best MatchPair
	bestScore := 0
	found := false
	for _, cand := range candidates {
		if used[cand.ID] {
			continue
		}
		score, diff, tolUsed := calculateMatchScore(flow, cand, rule)
		totalWeight := totalWeight(rule.Weights)
		threshold := int(math.Round(float64(totalWeight) * 0.8))
		if score >= threshold && score > bestScore {
			best = MatchPair{
				Flow1:         flow,
				Flow2:         cand,
				Score:         score,
				AmountDiff:    diff,
				ToleranceUsed: tolUsed,
			}
			bestScore = score
			found = true
		}
	}
	return best, found
}

func totalWeight(weights map[string]int) int {
	total := 0
	for _, w := range weights {
		total += w
	}
	return total
}

func calculateMatchScore(f1, f2 model.ClearFlow, rule config.MatchRule) (int, decimal.Decimal, bool) {
	score := 0
	toleranceUsed := false
	amountDiff := decimal.Zero
	for _, field := range rule.Fields {
		w, ok := rule.Weights[field]
		if !ok {
			w = 10
		}
		switch strings.ToLower(field) {
		case "biz_no":
			if strings.EqualFold(strings.TrimSpace(f1.BizNo), strings.TrimSpace(f2.BizNo)) {
				score += w
			} else if f1.RefNo != "" && f2.RefNo != "" && f1.RefNo == f2.RefNo {
				score += w
			} else if f1.RefNo != "" && (f1.RefNo == f2.BizNo || f2.RefNo == f1.BizNo) {
				score += w / 2
			}
		case "amount":
			diff := f1.Amount.Sub(f2.Amount).Abs()
			amountDiff = diff
			if diff.IsZero() {
				score += w
			} else if isWithinTolerance(diff, f1.Amount, rule.Tolerance) {
				score += w
				toleranceUsed = true
			} else {
				ratio := amountMatchRatio(diff, f1.Amount)
				score += int(float64(w) * ratio)
			}
		case "currency":
			if strings.EqualFold(f1.Currency, f2.Currency) {
				score += w
			}
		case "biz_date":
			if f1.BizDate == f2.BizDate {
				score += w
			}
		case "payer_account":
			if f1.PayerAccount != "" && f2.PayeeAccount != "" && f1.PayerAccount == f2.PayeeAccount {
				score += w
			}
		case "payee_account":
			if f1.PayeeAccount != "" && f2.PayerAccount != "" && f1.PayeeAccount == f2.PayerAccount {
				score += w
			}
		case "ref_no":
			if f1.RefNo != "" && f1.RefNo == f2.RefNo {
				score += w
			}
		}
	}
	return score, amountDiff, toleranceUsed
}

func isWithinTolerance(diff, amount decimal.Decimal, tolConfig map[string]interface{}) bool {
	mode, _ := tolConfig["mode"].(string)
	switch mode {
	case "fixed":
		fa, ok := tolConfig["fixed_amount"].(float64)
		if !ok {
			return false
		}
		fixed, _ := decimal.NewFromString(fmt.Sprintf("%f", fa))
		return diff.LessThanOrEqual(fixed)
	case "percentage":
		p, ok := tolConfig["percentage"].(float64)
		if !ok {
			return false
		}
		maxAmt, _ := tolConfig["max_amount"].(float64)
		maxAmtDec, _ := decimal.NewFromString(fmt.Sprintf("%f", maxAmt))
		pct := decimal.NewFromFloat(p)
		threshold := amount.Mul(pct).Div(decimal.NewFromInt(100))
		if maxAmtDec.IsPositive() && threshold.GreaterThan(maxAmtDec) {
			threshold = maxAmtDec
		}
		return diff.LessThanOrEqual(threshold)
	}
	return diff.IsZero()
}

func amountMatchRatio(diff, amount decimal.Decimal) float64 {
	if amount.IsZero() {
		return 0
	}
	ratio := diff.Div(amount.Abs()).InexactFloat64()
	if ratio >= 1.0 {
		return 0
	}
	return 1.0 - ratio
}

func (m *Matcher) ReconcileParallel(bizDate string, flows []model.ClearFlow, workers int) (*ReconcileResult, error) {
	if workers <= 0 {
		workers = 4
	}
	start := time.Now()
	result := &ReconcileResult{
		BizDate:    bizDate,
		TotalFlows: len(flows),
	}
	if len(flows) == 0 {
		return result, nil
	}

	outFlows, inFlows := splitFlowsByDirection(flows)
	idx := NewFlowIndex()
	idx.Add(inFlows)

	matchedMap := sync.Map{}
	var pairMutex sync.Mutex
	pairs := make([]MatchPair, 0)

	chunks := chunkFlows(outFlows, workers)
	var wg sync.WaitGroup

	for _, chunk := range chunks {
		wg.Add(1)
		go func(flows []model.ClearFlow) {
			defer wg.Done()
			for _, flow := range flows {
				if _, ok := matchedMap.Load(flow.ID); ok {
					continue
				}
				rule := m.engine.GetRule(flow.SrcInstID, flow.BizType)
				candidates := m.findCandidates(idx, flow)
				var best MatchPair
				bestScore := 0
				found := false
				for _, cand := range candidates {
					if _, used := matchedMap.Load(cand.ID); used {
						continue
					}
					score, diff, tolUsed := calculateMatchScore(flow, cand, rule)
					totalWeight := totalWeight(rule.Weights)
					threshold := int(math.Round(float64(totalWeight) * 0.8))
					if score >= threshold && score > bestScore {
						best = MatchPair{
							Flow1:         flow,
							Flow2:         cand,
							Score:         score,
							AmountDiff:    diff,
							ToleranceUsed: tolUsed,
						}
						bestScore = score
						found = true
					}
				}
				if found {
					matchedMap.Store(flow.ID, true)
					matchedMap.Store(best.Flow2.ID, true)
					pairMutex.Lock()
					pairs = append(pairs, best)
					pairMutex.Unlock()
				}
			}
		}(chunk)
	}
	wg.Wait()

	for _, p := range pairs {
		mr := model.MatchResult{
			FlowID1:       p.Flow1.ID,
			FlowID2:       p.Flow2.ID,
			MatchScore:    p.Score,
			AmountDiff:    p.AmountDiff,
			MatchType:     "BIDIRECTIONAL",
			ToleranceUsed: p.ToleranceUsed,
			MatchTime:     time.Now(),
			BizDate:       bizDate,
			SrcInstID:     p.Flow1.SrcInstID,
			DstInstID:     p.Flow1.DstInstID,
		}
		result.MatchedResults = append(result.MatchedResults, mr)
		if p.ToleranceUsed {
			result.TotalTolerance = result.TotalTolerance.Add(p.AmountDiff)
		}
	}
	result.MatchedPairs = len(pairs)

	for _, f := range flows {
		if _, ok := matchedMap.Load(f.ID); !ok {
			rule := m.engine.GetRule(f.SrcInstID, f.BizType)
			if rule.AllowOneSided {
				side := string(f.Direction)
				instID := f.SrcInstID
				if f.Direction == model.DirectionIn {
					instID = f.DstInstID
				}
				result.UnilateralFlows = append(result.UnilateralFlows, model.UnilateralFlow{
					FlowID:      f.ID,
					PendingSide: side,
					HangTime:    time.Now(),
					BizDate:     bizDate,
					InstID:      instID,
					Status:      model.StatusUnilateral,
				})
				result.UnilateralCount++
			} else {
				result.MismatchedFlows = append(result.MismatchedFlows, f)
				result.MismatchCount++
			}
		}
	}
	result.ProcessingTime = time.Since(start)
	return result, nil
}

func chunkFlows(flows []model.ClearFlow, n int) [][]model.ClearFlow {
	if n <= 0 {
		n = 1
	}
	result := make([][]model.ClearFlow, 0, n)
	size := (len(flows) + n - 1) / n
	for i := 0; i < len(flows); i += size {
		end := i + size
		if end > len(flows) {
			end = len(flows)
		}
		result = append(result, flows[i:end])
	}
	return result
}
