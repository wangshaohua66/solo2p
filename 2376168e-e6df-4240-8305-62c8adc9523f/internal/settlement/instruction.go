package settlement

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"clear-system/internal/config"
	"clear-system/internal/model"
)

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
		InstructionNo: no,
		SettleDate:    settleDate,
		Amount:        p.NetAmount.Abs(),
		Currency:      p.Currency,
		Format:        format,
		Status:        model.StatusParsed,
		CreateTime:    time.Now(),
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
