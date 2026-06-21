package reconcile

import (
	"clear-system/internal/config"
	"clear-system/internal/model"
)

type RuleEngine struct {
	cfg *config.AppConfig
}

func NewRuleEngine(cfg *config.AppConfig) *RuleEngine {
	return &RuleEngine{cfg: cfg}
}

func (e *RuleEngine) GetRule(instID string, bizType model.BizType) config.MatchRule {
	return e.cfg.GetMatchRule(instID, string(bizType))
}

func (e *RuleEngine) GetToleranceConfig(instID string, bizType model.BizType) *config.ToleranceConfig {
	rule := e.GetRule(instID, bizType)
	tol := &config.ToleranceConfig{Mode: "fixed", FixedAmount: 0.01, MaxAmount: 10.0}
	if rule.Tolerance == nil {
		return tol
	}
	if m, ok := rule.Tolerance["mode"]; ok {
		if s, ok2 := m.(string); ok2 {
			tol.Mode = s
		}
	}
	if m, ok := rule.Tolerance["fixed_amount"]; ok {
		switch v := m.(type) {
		case float64:
			tol.FixedAmount = v
		case int:
			tol.FixedAmount = float64(v)
		}
	}
	if m, ok := rule.Tolerance["percentage"]; ok {
		switch v := m.(type) {
		case float64:
			tol.Percentage = v
		case int:
			tol.Percentage = float64(v)
		}
	}
	if m, ok := rule.Tolerance["max_amount"]; ok {
		switch v := m.(type) {
		case float64:
			tol.MaxAmount = v
		case int:
			tol.MaxAmount = float64(v)
		}
	}
	return tol
}

func (e *RuleEngine) IsUnilateralAllowed(instID string, bizType model.BizType) bool {
	rule := e.GetRule(instID, bizType)
	if rule.AllowOneSided {
		return true
	}
	defRule := e.cfg.GetMatchRule("", "")
	return defRule.AllowOneSided
}

func (e *RuleEngine) GetTimeoutHours(instID string, bizType model.BizType) int {
	rule := e.GetRule(instID, bizType)
	if rule.TimeoutHours > 0 {
		return rule.TimeoutHours
	}
	defRule := e.cfg.GetMatchRule("", "")
	if defRule.TimeoutHours > 0 {
		return defRule.TimeoutHours
	}
	return 72
}

func (e *RuleEngine) GetMatchThresholdPercent(instID string, bizType model.BizType) int {
	return 80
}
