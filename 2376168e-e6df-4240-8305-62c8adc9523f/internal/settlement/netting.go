package settlement

import (
	"crypto/sha256"
	"encoding/hex"
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

type InstructionGenerator struct {
	cfg *config.AppConfig
}

func NewInstructionGenerator(cfg *config.AppConfig) *InstructionGenerator {
	return &InstructionGenerator{cfg: cfg}
}

func (g *InstructionGenerator) Generate(settleDate string, positions []model.NetPosition) []model.SettleInstruction {
	instructions := make([]model.SettleInstruction, 0, len(positions))
	for _, p := range positions {
		if p.NetAmount.IsZero() {
			continue
		}
		instructions = append(instructions, g.buildInstruction(settleDate, p))
	}
	return instructions
}

func (g *InstructionGenerator) buildInstruction(settleDate string, p model.NetPosition) model.SettleInstruction {
	format := g.cfg.Settlement.InstructionFormat
	if format == "" {
		format = "cfca"
	}
	no := generateInstructionNo(settleDate, p.InstID, p.Currency, p.NetAmount)

	si := model.SettleInstruction{
		InstructionNo:  no,
		SettleDate:     settleDate,
		Amount:         p.NetAmount.Abs(),
		Currency:       p.Currency,
		Format:         format,
		Status:         model.StatusParsed,
		CreateTime:     time.Now(),
	}

	if p.NetAmount.IsPositive() {
		si.ReceiverInstID = p.InstID
		si.SenderInstID = "CLEARING_CENTER"
	} else {
		si.SenderInstID = p.InstID
		si.ReceiverInstID = "CLEARING_CENTER"
	}

	switch strings.ToLower(format) {
	case "cfca":
		si.Content = generateCFCA(settleDate, p, si)
	default:
		si.Content = generateSimple(settleDate, p, si)
	}
	return si
}

func generateInstructionNo(settleDate, instID, currency string, amount decimal.Decimal) string {
	h := sha256.New()
	h.Write([]byte(fmt.Sprintf("%s|%s|%s|%s|%d",
		settleDate, instID, currency, amount.String(), time.Now().UnixNano())))
	sum := hex.EncodeToString(h.Sum(nil))[:12]
	return fmt.Sprintf("CLR%s%s%s", strings.ReplaceAll(settleDate, "-", ""), instID, strings.ToUpper(sum))
}

func generateCFCA(settleDate string, p model.NetPosition, si model.SettleInstruction) string {
	_ = p
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<CFCA>
  <MsgType>SETTLEMENT</MsgType>
  <MsgID>%s</MsgID>
  <SettleDate>%s</SettleDate>
  <Sender>%s</Sender>
  <Receiver>%s</Receiver>
  <Amount Currency="%s">%s</Amount>
  <Digest>%s</Digest>
  <Timestamp>%s</Timestamp>
</CFCA>`,
		si.InstructionNo, settleDate, si.SenderInstID,
		si.ReceiverInstID, si.Currency, si.Amount.String(),
		calcDigest(si), si.CreateTime.Format(time.RFC3339))
}

func calcDigest(si model.SettleInstruction) string {
	h := sha256.New()
	h.Write([]byte(fmt.Sprintf("%s|%s|%s|%s|%s",
		si.InstructionNo, si.SettleDate, si.SenderInstID,
		si.ReceiverInstID, si.Amount.String())))
	return hex.EncodeToString(h.Sum(nil))
}

func generateSimple(settleDate string, p model.NetPosition, si model.SettleInstruction) string {
	_ = p
	return fmt.Sprintf("%s,%s,%s,%s,%s,%s",
		si.InstructionNo, settleDate, si.SenderInstID,
		si.ReceiverInstID, si.Currency, si.Amount.String())
}
