package parser

import (
	"regexp"
	"strings"
	"time"

	"go.uber.org/zap"

	"drugvigil/config"
	"drugvigil/store"
)

type AdverseEventTerm struct {
	ZH string `json:"zh"`
	EN string `json:"en"`
	JA string `json:"ja"`
}

type SeverityMapping struct {
	Level   string
	ZH      []string
	EN      []string
	JA      []string
}

type NormalizedRecord struct {
	store.SecurityRecord
	StandardDrugName     string            `json:"standard_drug_name"`
	StandardAdverseEvent string            `json:"standard_adverse_event"`
	StandardSeverity     string            `json:"standard_severity"`
	Keywords             []string          `json:"keywords"`
	MatchedDrugs         []string          `json:"matched_drugs"`
	DrugMonitorLevel     string            `json:"drug_monitor_level"`
}

type Normalizer struct {
	cfg            *config.Config
	logger         *zap.Logger
	eventMappings  []*AdverseEventTerm
	severityLevels []SeverityMapping
	drugPatterns   map[string]*regexp.Regexp
	zhPattern      *regexp.Regexp
	enPattern      *regexp.Regexp
	jaPattern      *regexp.Regexp
}

func NewNormalizer(cfg *config.Config, logger *zap.Logger) *Normalizer {
	n := &Normalizer{
		cfg:            cfg,
		logger:         logger,
		eventMappings:  initEventMappings(),
		severityLevels: initSeverityLevels(),
		drugPatterns:   make(map[string]*regexp.Regexp),
		zhPattern:      regexp.MustCompile(`[\u4e00-\u9fa5]+`),
		enPattern:      regexp.MustCompile(`[a-zA-Z]+`),
		jaPattern:      regexp.MustCompile(`[\u3040-\u30ff\u4e00-\u9fa5]+`),
	}

	for _, drug := range cfg.Drugs {
		patterns := []string{drug.Name, drug.GenericName}
		patterns = append(patterns, drug.Aliases...)
		for _, p := range patterns {
			if p != "" {
				n.drugPatterns[p] = regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(p) + `\b`)
			}
		}
	}

	return n
}

func initEventMappings() []*AdverseEventTerm {
	return []*AdverseEventTerm{
		{ZH: "过敏反应", EN: "Allergic reaction", JA: "アレルギー反応"},
		{ZH: "过敏性休克", EN: "Anaphylactic shock", JA: "アナフィラキシーショック"},
		{ZH: "皮疹", EN: "Rash", JA: "発疹"},
		{ZH: "荨麻疹", EN: "Urticaria", JA: "蕁麻疹"},
		{ZH: "呼吸困难", EN: "Dyspnea", JA: "呼吸困難"},
		{ZH: "肝功能异常", EN: "Abnormal liver function", JA: "肝機能異常"},
		{ZH: "肾功能损害", EN: "Renal impairment", JA: "腎機能障害"},
		{ZH: "血小板减少", EN: "Thrombocytopenia", JA: "血小板減少"},
		{ZH: "白细胞减少", EN: "Leukopenia", JA: "白血球減少"},
		{ZH: "恶心呕吐", EN: "Nausea and vomiting", JA: "悪心嘔吐"},
		{ZH: "腹泻", EN: "Diarrhea", JA: "下痢"},
		{ZH: "头痛", EN: "Headache", JA: "頭痛"},
		{ZH: "头晕", EN: "Dizziness", JA: "めまい"},
		{ZH: "心悸", EN: "Palpitation", JA: "動悸"},
		{ZH: "心律失常", EN: "Arrhythmia", JA: "不整脈"},
		{ZH: "心肌梗死", EN: "Myocardial infarction", JA: "心筋梗塞"},
		{ZH: "死亡", EN: "Death", JA: "死亡"},
		{ZH: "严重肝损伤", EN: "Severe liver injury", JA: "重篤な肝障害"},
		{ZH: "横纹肌溶解", EN: "Rhabdomyolysis", JA: "横紋筋融解症"},
		{ZH: "间质性肺炎", EN: "Interstitial pneumonia", JA: "間質性肺炎"},
	}
}

func initSeverityLevels() []SeverityMapping {
	return []SeverityMapping{
		{
			Level: "critical",
			ZH:    []string{"死亡", "危及生命", "严重过敏", "过敏性休克", "严重肝损伤", "心肌梗死", "横纹肌溶解", "间质性肺炎"},
			EN:    []string{"death", "life-threatening", "anaphylactic shock", "fatal", "severe liver injury", "myocardial infarction"},
			JA:    []string{"死亡", "アナフィラキシーショック", "重篤な肝障害", "心筋梗塞", "横紋筋融解症"},
		},
		{
			Level: "serious",
			ZH:    []string{"严重", "较严重", "重度", "肝功能异常", "肾功能损害", "血小板减少", "白细胞减少", "心律失常", "呼吸困难"},
			EN:    []string{"serious", "severe", "abnormal liver function", "renal impairment", "thrombocytopenia", "arrhythmia", "dyspnea"},
			JA:    []string{"重篤", "重度", "肝機能異常", "腎機能障害", "血小板減少", "不整脈", "呼吸困難"},
		},
		{
			Level: "moderate",
			ZH:    []string{"中度", "较明显", "明显"},
			EN:    []string{"moderate", "significant"},
			JA:    []string{"中等度", "中度"},
		},
		{
			Level: "mild",
			ZH:    []string{"轻度", "轻微", "一般", "头痛", "头晕", "恶心", "呕吐", "腹泻", "皮疹", "荨麻疹"},
			EN:    []string{"mild", "minor", "headache", "dizziness", "nausea", "vomiting", "diarrhea", "rash", "urticaria"},
			JA:    []string{"軽度", "頭痛", "めまい", "悪心", "嘔吐", "下痢", "発疹", "蕁麻疹"},
		},
	}
}

func (n *Normalizer) Normalize(record *store.SecurityRecord) *NormalizedRecord {
	norm := &NormalizedRecord{
		SecurityRecord: *record,
	}

	norm.StandardDrugName = n.normalizeDrugName(record.DrugName, record.Language)
	norm.StandardAdverseEvent = n.normalizeAdverseEvent(record.AdverseEvent, record.Language)
	norm.StandardSeverity = n.normalizeSeverity(record.Severity, record.AdverseEvent, record.Language)
	norm.Keywords = n.extractKeywords(record)
	norm.MatchedDrugs = n.matchCompanyDrugs(record)

	if len(norm.MatchedDrugs) > 0 {
		if drug := n.cfg.GetDrug(norm.MatchedDrugs[0]); drug != nil {
			norm.DrugMonitorLevel = drug.MonitorLevel
		}
	}

	if record.PublishedDate.IsZero() {
		norm.PublishedDate = time.Now()
	}

	n.logger.Debug("normalized record",
		zap.String("drug", norm.StandardDrugName),
		zap.String("severity", norm.StandardSeverity),
		zap.Int("keywords", len(norm.Keywords)),
		zap.Int("matched_drugs", len(norm.MatchedDrugs)))

	return norm
}

func (n *Normalizer) normalizeDrugName(name string, lang string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}

	for _, drug := range n.cfg.Drugs {
		names := []string{drug.Name, drug.GenericName}
		names = append(names, drug.Aliases...)
		for _, dn := range names {
			if strings.EqualFold(dn, name) {
				return drug.Name
			}
		}
	}

	return name
}

func (n *Normalizer) normalizeAdverseEvent(event string, lang string) string {
	event = strings.TrimSpace(event)
	if event == "" {
		return ""
	}

	eventLower := strings.ToLower(event)

	for _, mapping := range n.eventMappings {
		switch lang {
		case "zh":
			if strings.Contains(event, mapping.ZH) {
				return mapping.EN
			}
		case "en":
			if strings.Contains(eventLower, strings.ToLower(mapping.EN)) {
				return mapping.EN
			}
		case "ja":
			if strings.Contains(event, mapping.JA) {
				return mapping.EN
			}
		default:
			if strings.Contains(event, mapping.ZH) ||
				strings.Contains(eventLower, strings.ToLower(mapping.EN)) ||
				strings.Contains(event, mapping.JA) {
				return mapping.EN
			}
		}
	}

	return event
}

func (n *Normalizer) normalizeSeverity(severity string, event string, lang string) string {
	combined := strings.ToLower(severity + " " + event)

	for _, level := range n.severityLevels {
		var terms []string
		switch lang {
		case "zh":
			terms = level.ZH
		case "en":
			terms = level.EN
		case "ja":
			terms = level.JA
		default:
			terms = append(append(level.ZH, level.EN...), level.JA...)
		}

		for _, term := range terms {
			if strings.Contains(combined, strings.ToLower(term)) {
				return level.Level
			}
		}
	}

	if severity == "" {
		return "moderate"
	}

	return "mild"
}

func (n *Normalizer) extractKeywords(record *store.SecurityRecord) []string {
	var keywords []string
	seen := make(map[string]bool)

	text := record.DrugName + " " + record.AdverseEvent + " " + record.Summary

	for _, mapping := range n.eventMappings {
		terms := []string{mapping.ZH, mapping.EN, mapping.JA}
		for _, term := range terms {
			if term != "" && strings.Contains(text, term) && !seen[mapping.EN] {
				keywords = append(keywords, mapping.EN)
				seen[mapping.EN] = true
			}
		}
	}

	drugKeywords := n.extractDrugNames(text)
	for _, d := range drugKeywords {
		if !seen[d] {
			keywords = append(keywords, d)
			seen[d] = true
		}
	}

	return keywords
}

func (n *Normalizer) extractDrugNames(text string) []string {
	var drugs []string

	if n.zhPattern.MatchString(text) {
		zhDrugPattern := regexp.MustCompile(`[\u4e00-\u9fa5]+(?:片|胶囊|注射液|颗粒|丸|软膏|乳膏|缓释片|控释片)?`)
		for _, match := range zhDrugPattern.FindAllString(text, -1) {
			if len(match) >= 2 {
				drugs = append(drugs, match)
			}
		}
	}

	if n.enPattern.MatchString(text) {
		enDrugPattern := regexp.MustCompile(`[A-Z][a-z]+(?:umab|umab|vir|oxacin|mycin|cillin|olol|pril|statin|sartan|prazole)?`)
		for _, match := range enDrugPattern.FindAllString(text, -1) {
			if len(match) >= 4 {
				drugs = append(drugs, match)
			}
		}
	}

	return drugs
}

func (n *Normalizer) matchCompanyDrugs(record *store.SecurityRecord) []string {
	var matched []string
	text := strings.ToLower(record.DrugName + " " + record.AdverseEvent + " " + record.Summary)

	for _, drug := range n.cfg.Drugs {
		patterns := []string{drug.Name, drug.GenericName}
		patterns = append(patterns, drug.Aliases...)

		for _, p := range patterns {
			if p == "" {
				continue
			}
			pattern := n.drugPatterns[p]
			if pattern == nil {
				pattern = regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(p) + `\b`)
				n.drugPatterns[p] = pattern
			}
			if pattern.MatchString(text) {
				matched = append(matched, drug.Name)
				break
			}
		}
	}

	return matched
}

func (n *Normalizer) BatchNormalize(records []*store.SecurityRecord) []*NormalizedRecord {
	normalized := make([]*NormalizedRecord, 0, len(records))
	for _, r := range records {
		normalized = append(normalized, n.Normalize(r))
	}
	return normalized
}

func (n *Normalizer) FilterRelevant(normalized []*NormalizedRecord) []*NormalizedRecord {
	var relevant []*NormalizedRecord
	for _, r := range normalized {
		if len(r.MatchedDrugs) > 0 {
			relevant = append(relevant, r)
			n.logger.Info("relevant record found",
				zap.String("drug", r.StandardDrugName),
				zap.String("severity", r.StandardSeverity),
				zap.String("source", r.SourceAgency))
		}
	}
	return relevant
}

func (n *Normalizer) GetSeverityEmoji(level string) string {
	switch level {
	case "critical":
		return "🔴"
	case "serious":
		return "🟠"
	case "moderate":
		return "🟡"
	case "mild":
		return "🟢"
	default:
		return "⚪"
	}
}

func (n *Normalizer) GetSeverityLabel(level string) string {
	switch level {
	case "critical":
		return "严重"
	case "serious":
		return "重要"
	case "moderate":
		return "中等"
	case "mild":
		return "一般"
	default:
		return "未知"
	}
}
