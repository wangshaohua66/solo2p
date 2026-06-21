package settlement

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"clear-system/internal/config"
	"clear-system/internal/model"
)

type NetCalculator struct {
	cfg *config.AppConfig
}

type posKey struct {
	instID   string
	currency string
}

func NewNetCalculator(cfg *config.AppConfig) *NetCalculator {
	return &NetCalculator{cfg: cfg}
}

type NettingInput struct {
	SettleDate      string
	Currencies      []string
	MatchedResults  []model.MatchResult
	UnilateralFlows []model.UnilateralFlow
	AllFlows        map[int64]model.ClearFlow
}

type NettingResult struct {
	SettleDate      string
	Positions       []model.NetPosition
	Instructions    []model.SettleInstruction
	ProcessingTime  time.Duration
	TotalAmount     decimal.Decimal
	MatchCount      int
	UnilateralCount int
	InstCount       int
}

func (nc *NetCalculator) Calculate(input *NettingInput) (*NettingResult, error) {
	start := time.Now()
	result := &NettingResult{
		SettleDate: input.SettleDate,
	}

	currencies := input.Currencies
	if len(currencies) == 0 {
		currencies = nc.cfg.Settlement.Currencies
		if len(currencies) == 0 {
			currencies = []string{"CNY"}
		}
	}

	positionMap := make(map[posKey]*model.NetPosition)
	matchCountMap := make(map[posKey]int)
	unilateralCountMap := make(map[posKey]int)

	for _, mr := range input.MatchedResults {
		flow1, ok1 := input.AllFlows[mr.FlowID1]
		flow2, ok2 := input.AllFlows[mr.FlowID2]
		if !ok1 || !ok2 {
			continue
		}
		result.MatchCount++

		outflow := flow1
		if flow1.Direction != model.DirectionOut {
			outflow = flow2
		}
		cur := outflow.Currency
		if !containsCurrency(currencies, cur) {
			continue
		}
		sender := outflow.SrcInstID
		receiver := outflow.DstInstID
		amount := outflow.Amount

		addAmount(positionMap, matchCountMap, posKey{sender, cur}, "PAY", amount)
		addAmount(positionMap, matchCountMap, posKey{receiver, cur}, "RECEIVE", amount)

		if mr.ToleranceUsed && mr.AmountDiff.IsPositive() {
			sourceInst := outflow.SrcInstID
			tolKey := posKey{sourceInst, cur}
			addAmount(positionMap, matchCountMap, tolKey, "PAY", mr.AmountDiff)
			recvKey := posKey{outflow.DstInstID, cur}
			addAmount(positionMap, matchCountMap, recvKey, "RECEIVE", mr.AmountDiff)
		}
	}

	for _, uf := range input.UnilateralFlows {
		flow, ok := input.AllFlows[uf.FlowID]
		if !ok {
			continue
		}
		result.UnilateralCount++
		cur := flow.Currency
		if !containsCurrency(currencies, cur) {
			continue
		}
		instID := uf.InstID
		key := posKey{instID, cur}
		if flow.Direction == model.DirectionOut {
			addAmount(positionMap, unilateralCountMap, key, "PAY", flow.Amount)
		} else {
			addAmount(positionMap, unilateralCountMap, key, "RECEIVE", flow.Amount)
		}
	}

	for key, pos := range positionMap {
		mc := matchCountMap[key]
		uc := unilateralCountMap[key]
		pos.NetAmount = pos.TotalReceive.Sub(pos.TotalPay)
		pos.MatchCount = mc
		pos.UnilateralCount = uc
		pos.SettleDate = input.SettleDate
		pos.InstID = key.instID
		pos.Currency = key.currency
		pos.Status = model.StatusMatched
		pos.CreateTime = time.Now()
		result.Positions = append(result.Positions, *pos)
		result.TotalAmount = result.TotalAmount.Add(pos.TotalReceive)
	}

	sort.Slice(result.Positions, func(i, j int) bool {
		return result.Positions[i].InstID < result.Positions[j].InstID
	})

	result.InstCount = len(result.Positions)
	result.ProcessingTime = time.Since(start)
	return result, nil
}

func (nc *NetCalculator) CalculateSimple(settleDate string, matched []model.MatchResult, currencies []string, flows map[int64]model.ClearFlow) ([]model.NetPosition, decimal.Decimal, map[string]int) {
	input := &NettingInput{
		SettleDate:     settleDate,
		Currencies:     currencies,
		MatchedResults: matched,
		AllFlows:       flows,
	}
	result, err := nc.Calculate(input)
	if err != nil {
		return nil, decimal.Zero, nil
	}
	stats := map[string]int{
		"match_count":      result.MatchCount,
		"unilateral_count": result.UnilateralCount,
		"inst_count":       result.InstCount,
	}
	return result.Positions, result.TotalAmount, stats
}

func addAmount(posMap map[posKey]*model.NetPosition, countMap map[posKey]int, key posKey, typ string, amt decimal.Decimal) {
	pos, ok := posMap[key]
	if !ok {
		pos = &model.NetPosition{
			TotalReceive: decimal.Zero,
			TotalPay:     decimal.Zero,
			NetAmount:    decimal.Zero,
		}
		posMap[key] = pos
	}
	switch typ {
	case "RECEIVE":
		pos.TotalReceive = pos.TotalReceive.Add(amt)
	case "PAY":
		pos.TotalPay = pos.TotalPay.Add(amt)
	}
	countMap[key]++
}

func containsCurrency(list []string, cur string) bool {
	for _, c := range list {
		if strings.EqualFold(c, cur) {
			return true
		}
	}
	return false
}

func (nc *NetCalculator) GetSettlementWindowEnd(date string) time.Time {
	yy := date[:4]
	mm := date[5:7]
	dd := date[8:10]
	t, err := time.Parse("2006-01-02 15:04:05", fmt.Sprintf("%s-%s-%s 18:30:00", yy, mm, dd))
	if err != nil {
		return time.Now().Add(time.Hour)
	}
	return t
}
