package matcher

import (
	"fmt"
	"regexp"
	"strings"
	"sync"

	goversion "github.com/hashicorp/go-version"

	"github.com/security/vulnmonitor/internal/logger"
	"github.com/security/vulnmonitor/internal/storage"
)

type Config struct {
	MinCVSSScore     float64            `yaml:"min_cvss_score"`
	ComponentAliases map[string][]string `yaml:"component_aliases"`
}

type MatchResult struct {
	Vuln            *storage.Vulnerability `json:"vuln"`
	AffectedAssets  []*storage.Asset       `json:"affected_assets"`
	MatchMode       string                 `json:"match_mode"`
	MatchConfidence float64                `json:"match_confidence"`
}

type Rule struct {
	Component     string  `yaml:"component"`
	VersionRange  string  `yaml:"version_range"`
	MinCVSS       float64 `yaml:"min_cvss"`
	SeverityFilter string `yaml:"severity_filter"`
}

type Matcher struct {
	cfg     Config
	log     *logger.Logger
	rules   []Rule
	aliases map[string][]string
	mu      sync.RWMutex
}

func New(cfg Config, log *logger.Logger) *Matcher {
	if log == nil {
		log = logger.Default()
	}

	aliases := make(map[string][]string)
	for comp, als := range cfg.ComponentAliases {
		key := normalizeComponent(comp)
		aliases[key] = make([]string, len(als))
		for i, a := range als {
			aliases[key][i] = normalizeComponent(a)
		}
	}

	return &Matcher{
		cfg:     cfg,
		log:     log,
		aliases: aliases,
	}
}

func (m *Matcher) LoadRules(rules []Rule) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rules = make([]Rule, len(rules))
	copy(m.rules, rules)
}

func (m *Matcher) Match(vuln *storage.Vulnerability, assets []*storage.Asset) *MatchResult {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if vuln.CVSSScore < m.cfg.MinCVSSScore {
		return nil
	}

	result := &MatchResult{
		Vuln:            vuln,
		AffectedAssets:  make([]*storage.Asset, 0),
		MatchMode:       "none",
		MatchConfidence: 0,
	}

	for _, asset := range assets {
		if match, mode, confidence := m.matchAsset(vuln, asset); match {
			result.AffectedAssets = append(result.AffectedAssets, asset)
			if confidence > result.MatchConfidence {
				result.MatchConfidence = confidence
				result.MatchMode = mode
			}
		}
	}

	if len(result.AffectedAssets) == 0 {
		return nil
	}

	vuln.AffectedAssets = make([]string, len(result.AffectedAssets))
	for i, a := range result.AffectedAssets {
		vuln.AffectedAssets[i] = a.Name
	}

	return result
}

func (m *Matcher) matchAsset(vuln *storage.Vulnerability, asset *storage.Asset) (bool, string, float64) {
	if !m.matchComponent(vuln.Component, asset.Component) {
		return false, "", 0
	}

	assetVersion := asset.Version
	if assetVersion == "" {
		return true, "component_only", 0.5
	}

	vulnRange := vuln.AffectedRange
	if vulnRange == "" || vulnRange == "*" {
		return true, "component_all_versions", 0.6
	}

	mode := "semver_range"
	confidence := 0.9

	if matched := m.matchVersionRange(assetVersion, vulnRange); matched {
		return true, mode, confidence
	}

	if matched := m.matchExactVersion(assetVersion, vulnRange); matched {
		return true, "exact_version", 0.95
	}

	if asset.VersionRange != "" {
		if m.rangeOverlaps(asset.VersionRange, vulnRange) {
			return true, "range_overlap", 0.7
		}
	}

	return false, "", 0
}

func (m *Matcher) matchComponent(vulnComp, assetComp string) bool {
	vulnNorm := normalizeComponent(vulnComp)
	assetNorm := normalizeComponent(assetComp)

	if vulnNorm == assetNorm {
		return true
	}

	for comp, aliases := range m.aliases {
		if comp == vulnNorm || comp == assetNorm {
			for _, alias := range aliases {
				if alias == vulnNorm || alias == assetNorm {
					return true
				}
			}
		}
	}

	if strings.Contains(vulnNorm, assetNorm) || strings.Contains(assetNorm, vulnNorm) {
		return true
	}

	return false
}

func (m *Matcher) matchVersionRange(version, rangeStr string) bool {
	v, err := goversion.NewVersion(version)
	if err != nil {
		m.log.Debugf("failed to parse version '%s': %v", version, err)
		return false
	}

	constraints, err := parseVersionRange(rangeStr)
	if err != nil {
		m.log.Debugf("failed to parse range '%s': %v", rangeStr, err)
		return false
	}

	return constraints.Check(v)
}

func (m *Matcher) matchExactVersion(version, rangeStr string) bool {
	parts := strings.Split(rangeStr, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == version {
			return true
		}
		if strings.HasPrefix(p, "=") && strings.TrimPrefix(p, "=") == version {
			return true
		}
	}
	return false
}

func (m *Matcher) rangeOverlaps(assetRange, vulnRange string) bool {
	assetCons, err := parseVersionRange(assetRange)
	if err != nil {
		return false
	}

	vulnCons, err := parseVersionRange(vulnRange)
	if err != nil {
		return false
	}

	return rangesOverlap(assetCons, vulnCons)
}

func parseVersionRange(rangeStr string) (goversion.Constraints, error) {
	rangeStr = normalizeRange(rangeStr)

	if strings.Contains(rangeStr, " - ") {
		rangeStr = convertHyphenRange(rangeStr)
	}

	rangeStr = expandCaretTilde(rangeStr)

	return goversion.NewConstraint(rangeStr)
}

func normalizeRange(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "||", ",")
	s = strings.ReplaceAll(s, "&&", ",")
	return s
}

func convertHyphenRange(s string) string {
	parts := strings.SplitN(s, "-", 2)
	if len(parts) != 2 {
		return s
	}
	low := strings.TrimSpace(parts[0])
	high := strings.TrimSpace(parts[1])
	return fmt.Sprintf(">=%s,<=%s", low, high)
}

func expandCaretTilde(s string) string {
	var result []string
	parts := strings.Split(s, ",")

	for _, p := range parts {
		p = strings.TrimSpace(p)
		if strings.HasPrefix(p, "^") {
			result = append(result, expandCaret(strings.TrimPrefix(p, "^")))
		} else if strings.HasPrefix(p, "~") {
			result = append(result, expandTilde(strings.TrimPrefix(p, "~")))
		} else {
			result = append(result, p)
		}
	}

	return strings.Join(result, ",")
}

func expandCaret(v string) string {
	parts := strings.Split(v, ".")
	if len(parts) < 2 {
		return ">=" + v
	}

	major := parts[0]
	if major == "0" && len(parts) >= 3 {
		minor := parts[1]
		return fmt.Sprintf(">=%s,<%s.%s", v, major, incVersion(minor))
	}

	return fmt.Sprintf(">=%s,<%s", v, incVersion(major)+".0.0")
}

func expandTilde(v string) string {
	parts := strings.Split(v, ".")
	if len(parts) < 2 {
		return ">=" + v
	}

	major := parts[0]
	minor := parts[1]
	return fmt.Sprintf(">=%s,<%s.%s", v, major, incVersion(minor))
}

func incVersion(s string) string {
	if n, err := fmt.Sscanf(s, "%d", new(int)); err == nil && n == 1 {
		var i int
		fmt.Sscanf(s, "%d", &i)
		return fmt.Sprintf("%d", i+1)
	}
	return s + "1"
}

func rangesOverlap(a, b goversion.Constraints) bool {
	testVersions := []string{
		"0.0.1", "1.0.0", "2.0.0", "3.0.0",
		"0.1.0", "1.1.0", "2.1.0",
		"0.0.0", "99.99.99",
	}

	for _, vs := range testVersions {
		v, err := goversion.NewVersion(vs)
		if err != nil {
			continue
		}
		if a.Check(v) && b.Check(v) {
			return true
		}
	}

	return false
}

func normalizeComponent(s string) string {
	s = strings.ToLower(s)
	s = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}

func (m *Matcher) FilterByRules(vuln *storage.Vulnerability) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.rules) == 0 {
		return true
	}

	for _, rule := range m.rules {
		if !m.matchComponent(vuln.Component, rule.Component) {
			continue
		}

		if rule.MinCVSS > 0 && vuln.CVSSScore < rule.MinCVSS {
			continue
		}

		if rule.SeverityFilter != "" {
			if string(vuln.Severity) != rule.SeverityFilter {
				continue
			}
		}

		if rule.VersionRange != "" && vuln.AffectedRange != "" {
			if !m.matchVersionRange("1.0.0", rule.VersionRange) {
				continue
			}
		}

		return true
	}

	return false
}

func (m *Matcher) BatchMatch(vulns []*storage.Vulnerability, assets []*storage.Asset) []*MatchResult {
	results := make([]*MatchResult, 0, len(vulns))
	for _, vuln := range vulns {
		if !m.FilterByRules(vuln) {
			continue
		}
		if result := m.Match(vuln, assets); result != nil {
			results = append(results, result)
		}
	}
	return results
}

func (m *Matcher) Deduplicate(vulns []*storage.Vulnerability) []*storage.Vulnerability {
	seen := make(map[string]*storage.Vulnerability)

	for _, v := range vulns {
		key := v.CVEID
		if key == "" {
			key = fmt.Sprintf("%s-%s", v.Source, v.ID)
		}

		if existing, ok := seen[key]; ok {
			mergeVulns(existing, v)
		} else {
			seen[key] = v
		}
	}

	result := make([]*storage.Vulnerability, 0, len(seen))
	for _, v := range seen {
		result = append(result, v)
	}

	return result
}

func mergeVulns(dst, src *storage.Vulnerability) {
	if src.CVSSScore > dst.CVSSScore {
		dst.CVSSScore = src.CVSSScore
		dst.Severity = src.Severity
	}

	if src.Description != "" && (dst.Description == "" || len(src.Description) > len(dst.Description)) {
		dst.Description = src.Description
	}

	refSet := make(map[string]bool)
	for _, r := range dst.References {
		refSet[r] = true
	}
	for _, r := range src.References {
		if !refSet[r] {
			dst.References = append(dst.References, r)
			refSet[r] = true
		}
	}

	cweSet := make(map[string]bool)
	for _, c := range dst.CWEs {
		cweSet[c] = true
	}
	for _, c := range src.CWEs {
		if !cweSet[c] {
			dst.CWEs = append(dst.CWEs, c)
			cweSet[c] = true
		}
	}

	if src.PublishedAt.Before(dst.PublishedAt) {
		dst.PublishedAt = src.PublishedAt
	}

	if src.UpdatedAt.After(dst.UpdatedAt) {
		dst.UpdatedAt = src.UpdatedAt
	}

	if src.FixedVersion != "" && dst.FixedVersion == "" {
		dst.FixedVersion = src.FixedVersion
	}

	if src.AffectedRange != "" && dst.AffectedRange == "" {
		dst.AffectedRange = src.AffectedRange
	}
}

func (m *Matcher) GenerateAssetFingerprint(asset *storage.Asset) string {
	return fmt.Sprintf("%s:%s:%s",
		normalizeComponent(asset.Component),
		asset.Version,
		asset.Environment)
}
