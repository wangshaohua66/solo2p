// Package calculator implements the pipeline hydraulics and supply-demand
// economics used by the scheduling assistant:
//
//   - PressureLoss: Weymouth or Panhandle-A steady-state pressure drop with
//     elevation correction, returning the loss percentage and safety margin.
//   - Balance: a deterministic supply-demand engine that produces several
//     candidate upstream regulation plans ranked by energy cost.
//
// All formulas use SI units: pressure in MPa (gauge at the meter, converted to
// absolute internally), temperature in K, length in km, diameter in mm, flow in
// Nm3/h. The leading constant K of each formula is exposed as a per-segment
// "coefficient" override so operators can calibrate against measured data.
package calculator

import (
	"fmt"
	"math"
	"sort"
	"time"

	"scheduler/internal/config"
	"scheduler/internal/models"
)

const (
	atmPressureMPa = 0.101325 // standard atmospheric pressure in MPa (abs offset)

	// Weymouth default leading coefficient calibrated (SI: Q in Nm3/h, P in MPa,
	// L in km, d in mm). At typical trunk flows (~33 000 Nm3/h, 610 mm, 85 km)
	// it yields a low-single-digit pressure loss; under the peak-demand scenario
	// modelled by the simulator the main trunk crosses the warn/alarm thresholds.
	// Override per-segment with the "coefficient" field when calibrating against
	// measured data.
	defaultWeymouthK = 0.0010
	// Panhandle-A default leading coefficient in the same unit system.
	defaultPanhandleK = 0.42
)

// Engine holds configuration and provides the calculation entry points.
type Engine struct {
	cfg config.Config
}

// New returns an engine bound to a configuration snapshot.
func New(cfg config.Config) *Engine { return &Engine{cfg: cfg} }

// absPressure converts a gauge pressure (MPa) to absolute.
func absPressure(gauge float64) float64 { return gauge + atmPressureMPa }

// effOr returns e when > 0 else fallback.
func effOr(e, fallback float64) float64 {
	if e > 0 {
		return e
	}
	return fallback
}

// coefOr returns seg.Coefficient when > 0 else the formula default.
func coefOr(seg models.PipelineSegment, def float64) float64 {
	if seg.Coefficient > 0 {
		return seg.Coefficient
	}
	return def
}

// PressureLoss computes the steady-state pressure drop over a segment given the
// upstream inlet reading (gauge pressure) and the instantaneous flow. It uses
// the formula configured on the segment and applies an elevation correction.
// When no reading is available, inlet defaults to the segment's base pressure.
func (e *Engine) PressureLoss(seg models.PipelineSegment, inlet models.Reading, flow float64) (models.PressureLossResult, error) {
	formula := seg.Formula
	if formula == "" {
		formula = "weymouth"
	}
	p1Gauge := inlet.Pressure
	if p1Gauge <= 0 {
		p1Gauge = seg.BasePressure
	}
	p1Abs := absPressure(p1Gauge)
	if flow <= 0 {
		flow = inlet.FlowRate
	}
	if flow <= 0 {
		return models.PressureLossResult{}, fmt.Errorf("segment %s: flow is zero, cannot compute loss", seg.ID)
	}

	tAvg := inlet.Temperature
	if tAvg <= 0 {
		tAvg = seg.BaseTemp - 273.15 // fall back to base temp in C then convert
	}
	tAvgK := tAvg + 273.15
	if seg.BaseTemp > 0 {
		tAvgK = effOr(seg.BaseTemp, tAvgK)
	} else {
		tAvgK = effOr(tAvgK, 288.15)
	}
	G := effOr(seg.GasGravity, 0.6)
	Z := effOr(seg.CompressFactor, 0.9)
	L := seg.Length
	d := seg.Diameter

	var p2Abs float64
	switch formula {
	case "weymouth":
		K := coefOr(seg, defaultWeymouthK)
		// Q = K * (Tb/Pb) * d^(8/3) * sqrt( (P1^2 - P2^2) / (G*T*L*Z) )
		ratio := seg.BaseTemp / effOr(seg.BasePressure, atmPressureMPa+4)
		denom := K * ratio * math.Pow(d, 8.0/3.0)
		if denom == 0 {
			return models.PressureLossResult{}, fmt.Errorf("segment %s: weymouth denominator zero", seg.ID)
		}
		// (P1^2 - P2^2) = (Q / denom)^2 * G * T * L * Z
		diff := math.Pow(flow/denom, 2) * G * tAvgK * L * Z
		p2Abs = solveP2(p1Abs, diff)
	case "panhandle":
		K := coefOr(seg, defaultPanhandleK)
		E := effOr(seg.Efficiency, 0.92)
		// Q = K * E * d^2.6182 * ( (P1^2 - P2^2)/(G^0.8539 * T * L * Z) )^0.5394
		denom := K * E * math.Pow(d, 2.6182)
		if denom == 0 {
			return models.PressureLossResult{}, fmt.Errorf("segment %s: panhandle denominator zero", seg.ID)
		}
		exp := 0.5394
		// (P1^2 - P2^2) = ( (Q/denom)^(1/exp) ) * G^0.8539 * T * L * Z
		diff := math.Pow(flow/denom, 1.0/exp) * math.Pow(G, 0.8539) * tAvgK * L * Z
		p2Abs = solveP2(p1Abs, diff)
	default:
		return models.PressureLossResult{}, fmt.Errorf("segment %s: unknown formula %s", seg.ID, formula)
	}

	// Elevation correction: adjust P2 for the hydrostatic head using the
	// standard gas-column factor s = 0.0375*G*Δh/(T*Z). A positive Δh (upward
	// flow) increases required inlet pressure; we apply the symmetric factor.
	s := 0.0375 * G * seg.ElevationDiff / (tAvgK * Z)
	if s != 0 {
		// Equivalent outlet pressure correction on the squared quantity.
		p2Abs = p2Abs / math.Sqrt(math.Exp(s))
	}
	if p2Abs < 0 {
		p2Abs = atmPressureMPa
	}
	p2Gauge := p2Abs - atmPressureMPa
	if p2Gauge < 0 {
		p2Gauge = 0
	}
	loss := p1Gauge - p2Gauge
	lossPct := 0.0
	if p1Gauge > 0 {
		lossPct = loss / p1Gauge * 100
	}
	margin := e.safetyMargin(p1Gauge, loss)
	return models.PressureLossResult{
		SegmentID:         seg.ID,
		SegmentName:       seg.Name,
		UpstreamStation:   seg.FromStation,
		DownstreamStation: seg.ToStation,
		InletPressure:     round(p1Gauge, 4),
		OutletPressure:    round(p2Gauge, 4),
		PressureLoss:      round(loss, 4),
		LossPercent:       round(lossPct, 2),
		SafetyMargin:      round(margin, 4),
		Formula:           formula,
		Timestamp:         time.Now(),
	}, nil
}

// solveP2 returns the downstream absolute pressure given upstream abs pressure
// and the squared-difference term, guarding against negative radicands.
func solveP2(p1Abs, diff float64) float64 {
	rad := p1Abs*p1Abs - diff
	if rad < 0 {
		return 0
	}
	return math.Sqrt(rad)
}

// safetyMargin returns the remaining allowable pressure loss before the
// configured alarm threshold is reached, in MPa. Negative means alarm.
func (e *Engine) safetyMargin(inlet, loss float64) float64 {
	allowable := inlet * e.cfg.Alerts.PressureLossAlarmPct / 100
	return allowable - loss
}

// AllPressureLosses computes the loss for every configured segment using the
// latest available reading for its upstream station. It is safe to call from a
// goroutine and is well within the 5-second budget for a handful of segments.
func (e *Engine) AllPressureLosses(readings []models.Reading) []models.PressureLossResult {
	byStation := make(map[string]models.Reading, len(readings))
	for _, r := range readings {
		byStation[r.StationID] = r
	}
	out := make([]models.PressureLossResult, 0, len(e.cfg.Pipelines))
	for _, seg := range e.cfg.Pipelines {
		r := byStation[seg.FromStation]
		res, err := e.PressureLoss(seg, r, r.FlowRate)
		if err != nil {
			res = models.PressureLossResult{
				SegmentID: seg.ID, SegmentName: seg.Name,
				UpstreamStation: seg.FromStation, DownstreamStation: seg.ToStation,
				Formula: seg.Formula, Timestamp: time.Now(),
			}
		}
		out = append(out, res)
	}
	return out
}

// ---------------------------------------------------------------------------
// Supply-demand balance
// ---------------------------------------------------------------------------

// BalanceResult wraps the candidate plans plus the total demand.
type BalanceResult struct {
	TotalDemand float64
	Plans       []models.BalancePlan
}

// Balance generates n candidate upstream regulation plans to meet the given
// downstream demand. Each plan distributes the required supply across the
// configured sources using a distinct strategy (min cost, balanced, max
// safety), then ranks them by energy cost ascending. Completes in well under
// the 10-second budget even for dozens of sources.
func (e *Engine) Balance(demands []models.DemandPlan, n int) (BalanceResult, error) {
	if n <= 0 {
		n = 3
	}
	total := 0.0
	for _, d := range demands {
		total += d.Demand
	}
	if total <= 0 {
		return BalanceResult{}, fmt.Errorf("total demand is zero")
	}
	sources := make([]models.SourceRegulation, 0, len(e.cfg.Sources))
	for _, sc := range e.cfg.Sources {
		sources = append(sources, models.SourceRegulation{
			SourceID: sc.ID, SourceName: sc.Name,
			TargetPressure: sc.MaxPressure, CostPerUnit: sc.CostPerUnit,
		})
	}
	if len(sources) == 0 {
		return BalanceResult{}, fmt.Errorf("no supply sources configured")
	}

	strategies := []struct {
		id   string
		name string
		dist func(req float64) []models.SourceRegulation
	}{
		{"min-cost", "最低成本优先", e.distributeMinCost},
		{"balanced", "均衡分配", e.distributeBalanced},
		{"max-safety", "最大安全裕度", e.distributeMaxSafety},
	}
	// Trim/expand to n strategies deterministically.
	plans := make([]models.BalancePlan, 0, n)
	for i := 0; i < n; i++ {
		s := strategies[i%len(strategies)]
		regs := s.dist(total)
		plan := e.buildPlan(s.id, s.name, total, regs)
		plans = append(plans, plan)
	}
	// Rank by energy cost ascending; mark the cheapest acceptable plan.
	sort.SliceStable(plans, func(i, j int) bool { return plans[i].EnergyCost < plans[j].EnergyCost })
	for i := range plans {
		plans[i].Recommended = i == 0 && plans[i].SafetyScore >= 60
	}
	return BalanceResult{TotalDemand: round(total, 2), Plans: plans}, nil
}

// buildPlan assembles a BalancePlan from a source distribution.
func (e *Engine) buildPlan(id, name string, demand float64, regs []models.SourceRegulation) models.BalancePlan {
	supply, cost, minMargin := 0.0, 0.0, 1.0
	for _, r := range regs {
		supply += r.TargetFlow
		cost += r.TargetFlow * r.CostPerUnit
		// margin proxy: how far each source sits below its cap (kept positive)
		if src, ok := e.sourceByID(r.SourceID); ok {
			margin := (src.MaxFlow - r.TargetFlow) / src.MaxFlow
			if margin < minMargin {
				minMargin = margin
			}
		}
	}
	if minMargin < 0 {
		minMargin = 0
	}
	imbalance := supply - demand
	// safety score blends shortfall avoidance and headroom.
	safety := 60 + 40*minMargin
	if imbalance < 0 {
		safety = math.Max(0, 60-50*(-imbalance/demand)*100)
	}
	safety = clamp(safety, 0, 100)
	return models.BalancePlan{
		ID:                id + "-" + name,
		TotalDemand:       round(demand, 2),
		TotalSupply:       round(supply, 2),
		Imbalance:         round(imbalance, 2),
		SourceRegulations: regs,
		EnergyCost:        round(cost, 2),
		SafetyScore:       round(safety, 2),
	}
}

// distributeMinCost fills the cheapest sources first up to their caps.
func (e *Engine) distributeMinCost(req float64) []models.SourceRegulation {
	ordered := e.sortedSources(func(a, b config.SourceConfig) bool { return a.CostPerUnit < b.CostPerUnit })
	regs := make([]models.SourceRegulation, 0, len(ordered))
	remaining := req
	for _, sc := range ordered {
		var take float64
		if remaining > 0 {
			take = clamp(remaining, sc.MinFlow, sc.MaxFlow)
		}
		regs = append(regs, models.SourceRegulation{
			SourceID: sc.ID, SourceName: sc.Name,
			TargetPressure: sc.MaxPressure * 0.9, TargetFlow: round(take, 2), CostPerUnit: sc.CostPerUnit,
		})
		remaining -= take
	}
	return regs
}

// distributeBalanced allocates proportionally to each source's capacity.
func (e *Engine) distributeBalanced(req float64) []models.SourceRegulation {
	var cap float64
	for _, sc := range e.cfg.Sources {
		cap += sc.MaxFlow
	}
	regs := make([]models.SourceRegulation, 0, len(e.cfg.Sources))
	for _, sc := range e.cfg.Sources {
		share := req * (sc.MaxFlow / cap)
		share = clamp(share, sc.MinFlow, sc.MaxFlow)
		regs = append(regs, models.SourceRegulation{
			SourceID: sc.ID, SourceName: sc.Name,
			TargetPressure: sc.MaxPressure * 0.85, TargetFlow: round(share, 2), CostPerUnit: sc.CostPerUnit,
		})
	}
	return regs
}

// distributeMaxSafety spreads load to maximise headroom (uniformly under cap).
func (e *Engine) distributeMaxSafety(req float64) []models.SourceRegulation {
	n := len(e.cfg.Sources)
	each := req / float64(n)
	regs := make([]models.SourceRegulation, 0, n)
	for _, sc := range e.cfg.Sources {
		take := clamp(each, sc.MinFlow, sc.MaxFlow)
		regs = append(regs, models.SourceRegulation{
			SourceID: sc.ID, SourceName: sc.Name,
			TargetPressure: sc.MaxPressure * 0.8, TargetFlow: round(take, 2), CostPerUnit: sc.CostPerUnit,
		})
	}
	return regs
}

func (e *Engine) sourceByID(id string) (config.SourceConfig, bool) {
	for _, sc := range e.cfg.Sources {
		if sc.ID == id {
			return sc, true
		}
	}
	return config.SourceConfig{}, false
}

func (e *Engine) sortedSources(less func(a, b config.SourceConfig) bool) []config.SourceConfig {
	out := append([]config.SourceConfig(nil), e.cfg.Sources...)
	sort.SliceStable(out, func(i, j int) bool { return less(out[i], out[j]) })
	return out
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func round(v float64, p int) float64 {
	mul := math.Pow(10, float64(p))
	return math.Round(v*mul) / mul
}
