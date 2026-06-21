// Package scheduler turns calculation results into standardised, prioritised
// dispatch instructions. It consumes pressure-loss results (to flag segments at
// or near their alarm threshold) and balance plans (to drive upstream source
// adjustments), assigns an urgency level, attaches a safety note and renders a
// human-readable command string for the operator.
package scheduler

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"scheduler/internal/config"
	"scheduler/internal/models"
)

// Generator produces dispatch instructions from calculation outputs.
type Generator struct {
	cfg config.Config
}

// New returns a generator bound to a configuration snapshot.
func New(cfg config.Config) *Generator { return &Generator{cfg: cfg} }

// FromPressureLosses creates instructions for segments whose pressure loss
// exceeds the warning threshold or whose safety margin has gone negative.
func (g *Generator) FromPressureLosses(results []models.PressureLossResult) []models.DispatchInstruction {
	out := make([]models.DispatchInstruction, 0, len(results))
	for _, r := range results {
		urgency := g.urgencyForLoss(r)
		if urgency == "" {
			continue
		}
		station, _ := g.cfg.StationByID(r.UpstreamStation)
		name := station.Name
		if name == "" {
			name = r.SegmentName
		}
		out = append(out, models.DispatchInstruction{
			ID:          fmt.Sprintf("%s-%d", r.SegmentID, r.Timestamp.Unix()),
			StationID:   r.UpstreamStation,
			StationName: name,
			Urgency:     urgency,
			AdjustType:  "pressure",
			TargetValue: r.InletPressure,
			Current:     r.OutletPressure,
			ExecuteFrom: r.Timestamp,
			ExecuteTo:   r.Timestamp.Add(30 * time.Minute),
			SafetyNotes: g.safetyNote(urgency, r.SegmentName, r.LossPercent),
			Status:      "draft",
			Reason: fmt.Sprintf("管段 %s 压损 %.2f%% 安全裕度 %.3fMPa",
				r.SegmentName, r.LossPercent, r.SafetyMargin),
			CreatedAt: time.Now(),
		})
	}
	return out
}

// urgencyForLoss maps a pressure loss result to an urgency, or "" when no
// action is required.
func (g *Generator) urgencyForLoss(r models.PressureLossResult) models.Urgency {
	switch {
	case r.SafetyMargin < 0 || r.LossPercent >= g.cfg.Alerts.PressureLossAlarmPct:
		return models.UrgencyCritical
	case r.LossPercent >= g.cfg.Alerts.PressureLossWarnPct:
		return models.UrgencyHigh
	default:
		return ""
	}
}

// FromBalancePlan creates one instruction per upstream source regulation in the
// recommended (or specified) plan.
func (g *Generator) FromBalancePlan(plan models.BalancePlan) []models.DispatchInstruction {
	out := make([]models.DispatchInstruction, 0, len(plan.SourceRegulations))
	for _, reg := range plan.SourceRegulations {
		out = append(out, models.DispatchInstruction{
			ID:          fmt.Sprintf("BP-%s-%s-%d", plan.ID, reg.SourceID, time.Now().Unix()),
			StationID:   reg.SourceID,
			StationName: reg.SourceName,
			Urgency:     models.UrgencyNormal,
			AdjustType:  "flow",
			TargetValue: reg.TargetFlow,
			Current:     reg.TargetPressure,
			ExecuteFrom: time.Now(),
			ExecuteTo:   time.Now().Add(1 * time.Hour),
			SafetyNotes: g.safetyNote(models.UrgencyNormal, reg.SourceName, 0),
			Status:      "draft",
			Reason: fmt.Sprintf("供需平衡方案 %s：目标供气 %.0f Nm3/h 供气压力 %.2f MPa",
				plan.ID, reg.TargetFlow, reg.TargetPressure),
			CreatedAt: time.Now(),
		})
	}
	return out
}

// SortByUrgency orders instructions critical-first then by creation time.
func SortByUrgency(in []models.DispatchInstruction) {
	sort.SliceStable(in, func(i, j int) bool {
		return urgencyRank(in[i].Urgency) < urgencyRank(in[j].Urgency)
	})
}

func urgencyRank(u models.Urgency) int {
	switch u {
	case models.UrgencyCritical:
		return 0
	case models.UrgencyHigh:
		return 1
	case models.UrgencyNormal:
		return 2
	case models.UrgencyLow:
		return 3
	default:
		return 4
	}
}

// safetyNote returns a standardised safety reminder whose detail depends on the
// urgency level. It is appended to every instruction so nothing is lost when
// instructions are exported without context.
func (g *Generator) safetyNote(u models.Urgency, segment string, lossPct float64) string {
	base := fmt.Sprintf("执行前确认管段 %s 上下游通讯正常，记录前后压力读数。", segment)
	switch u {
	case models.UrgencyCritical:
		return base + " 属紧急调度，须双人复核，调节速率不超过 0.05 MPa/min，防止超压或工况突变。"
	case models.UrgencyHigh:
		return base + " 调节过程中持续监视末端压力，每 5 分钟记录一次。"
	default:
		return base + " 按常规规程执行，调节后 15 分钟内复查。"
	}
}

// Render formats a single instruction as the standardised text an operator reads
// aloud or pastes into the dispatch log.
func Render(d models.DispatchInstruction) string {
	var b strings.Builder
	fmt.Fprintf(&b, "【调度指令 %s】\n", strings.ToUpper(string(d.Urgency)))
	fmt.Fprintf(&b, "指令编号：%s\n", d.ID)
	fmt.Fprintf(&b, "站点编号：%s（%s）\n", d.StationID, d.StationName)
	fmt.Fprintf(&b, "调节类型：%s\n", adjustTypeLabel(d.AdjustType))
	fmt.Fprintf(&b, "目标值　：%.4f\n", d.TargetValue)
	fmt.Fprintf(&b, "当前值　：%.4f\n", d.Current)
	fmt.Fprintf(&b, "执行时段：%s 至 %s\n", d.ExecuteFrom.Format("01-02 15:04"), d.ExecuteTo.Format("01-02 15:04"))
	if d.Reason != "" {
		fmt.Fprintf(&b, "调度依据：%s\n", d.Reason)
	}
	if d.SafetyNotes != "" {
		fmt.Fprintf(&b, "安全提示：%s\n", d.SafetyNotes)
	}
	if d.Operator != "" {
		fmt.Fprintf(&b, "调度员　：%s\n", d.Operator)
	}
	fmt.Fprintf(&b, "生成时间：%s\n", d.CreatedAt.Format("2006-01-02 15:04:05"))
	return b.String()
}

func adjustTypeLabel(t string) string {
	switch t {
	case "pressure":
		return "压力调节"
	case "flow":
		return "流量调节"
	case "valve":
		return "阀门操作"
	default:
		return t
	}
}
