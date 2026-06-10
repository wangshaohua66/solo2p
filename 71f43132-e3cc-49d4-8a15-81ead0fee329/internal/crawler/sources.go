package crawler

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"

	"github.com/security/vulnmonitor/internal/logger"
	"github.com/security/vulnmonitor/internal/retry"
	"github.com/security/vulnmonitor/internal/storage"
)

type NVDCrawler struct {
	*BaseCrawler
}

func NewNVDCrawler(cfg SourceConfig, log *logger.Logger, retryer *retry.Retryer) *NVDCrawler {
	return &NVDCrawler{BaseCrawler: NewBaseCrawler(cfg.ID, cfg.Name, cfg, log, retryer)}
}

func (c *NVDCrawler) Fetch(ctx context.Context, fullRefresh bool) ([]*storage.Vulnerability, error) {
	vulns := make([]*storage.Vulnerability, 0)
	baseURL := c.cfg.URL
	if baseURL == "" {
		baseURL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
	}

	startIndex := 0
	resultsPerPage := 2000
	maxPages := 5

	for page := 0; page < maxPages; page++ {
		select {
		case <-ctx.Done():
			return vulns, ctx.Err()
		default:
		}

		url := fmt.Sprintf("%s?startIndex=%d&resultsPerPage=%d", baseURL, startIndex, resultsPerPage)
		if !fullRefresh {
			pubStart := time.Now().AddDate(0, 0, -7).Format("2006-01-02T15:04:05.000")
			url += fmt.Sprintf("&pubStartDate=%sZ", pubStart)
		}

		var resp *http.Response
		err := c.retryer.Do(ctx, fmt.Sprintf("nvd-fetch-page-%d", page), func(ctx context.Context) error {
			req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
			if err != nil {
				return err
			}
			req.Header.Set("User-Agent", "VulnMonitor/1.0")
			if c.cfg.APIToken != "" {
				req.Header.Set("apiKey", c.cfg.APIToken)
			}

			client := &http.Client{Timeout: 60 * time.Second}
			r, err := client.Do(req)
			if err != nil {
				return err
			}
			resp = r
			return nil
		})
		if err != nil {
			return vulns, err
		}

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		var result NVDResponse
		if err := json.Unmarshal(body, &result); err != nil {
			return vulns, err
		}

		for _, item := range result.Vulnerabilities {
			v := parseNVDCVE(item.CVE)
			if v != nil {
				v.Source = "NVD"
				vulns = append(vulns, v)
			}
		}

		if len(result.Vulnerabilities) < resultsPerPage {
			break
		}
		startIndex += resultsPerPage
	}

	return vulns, nil
}

type NVDResponse struct {
	Vulnerabilities []NVDVulnItem `json:"vulnerabilities"`
	ResultsPerPage  int           `json:"resultsPerPage"`
	StartIndex      int           `json:"startIndex"`
	TotalResults    int           `json:"totalResults"`
}

type NVDVulnItem struct {
	CVE NVDCVE `json:"cve"`
}

type NVDCVE struct {
	ID               string          `json:"id"`
	Published        string          `json:"published"`
	LastModified     string          `json:"lastModified"`
	VulnStatus       string          `json:"vulnStatus"`
	Descriptions     []NVDLang       `json:"descriptions"`
	Metrics          NVDMetrics      `json:"metrics"`
	Weaknesses       []NVDWeakness   `json:"weaknesses"`
	Configurations   []NVDConfig     `json:"configurations"`
	References       []NVDReference  `json:"references"`
}

type NVDLang struct {
	Lang  string `json:"lang"`
	Value string `json:"value"`
}

type NVDMetrics struct {
	CvssMetricV31 []NVDCVSSMetric `json:"cvssMetricV31"`
	CvssMetricV30 []NVDCVSSMetric `json:"cvssMetricV30"`
	CvssMetricV2  []NVDCVSSMetric `json:"cvssMetricV2"`
}

type NVDCVSSMetric struct {
	CvssData NVDCVSSData `json:"cvssData"`
	BaseScore float64    `json:"baseScore"`
}

type NVDCVSSData struct {
	Version      string  `json:"version"`
	VectorString string  `json:"vectorString"`
	BaseScore    float64 `json:"baseScore"`
	BaseSeverity string  `json:"baseSeverity"`
}

type NVDWeakness struct {
	Description []NVDLang `json:"description"`
}

type NVDConfig struct {
	Nodes []NVDNode `json:"nodes"`
}

type NVDNode struct {
	CPEMatch []NVDCPEMatch `json:"cpeMatch"`
}

type NVDCPEMatch struct {
	Vulnerable            bool   `json:"vulnerable"`
	CPE23URI              string `json:"cpe23Uri"`
	VersionStartIncluding string `json:"versionStartIncluding"`
	VersionStartExcluding string `json:"versionStartExcluding"`
	VersionEndIncluding   string `json:"versionEndIncluding"`
	VersionEndExcluding   string `json:"versionEndExcluding"`
}

type NVDReference struct {
	URL    string   `json:"url"`
	Source string   `json:"source"`
	Tags   []string `json:"tags"`
}

func parseNVDCVE(cve NVDCVE) *storage.Vulnerability {
	if cve.ID == "" {
		return nil
	}

	v := &storage.Vulnerability{
		ID:           fmt.Sprintf("nvd-%s", cve.ID),
		CVEID:        cve.ID,
		DiscoveredAt: time.Now(),
	}

	for _, d := range cve.Descriptions {
		if d.Lang == "en" {
			v.Description = d.Value
			break
		}
	}

	v.Title = extractTitle(v.Description)

	var cvssScore float64
	var cvssVector string
	var severity string

	if len(cve.Metrics.CvssMetricV31) > 0 {
		cvssScore = cve.Metrics.CvssMetricV31[0].BaseScore
		cvssVector = cve.Metrics.CvssMetricV31[0].CvssData.VectorString
		severity = cve.Metrics.CvssMetricV31[0].CvssData.BaseSeverity
	} else if len(cve.Metrics.CvssMetricV30) > 0 {
		cvssScore = cve.Metrics.CvssMetricV30[0].BaseScore
		cvssVector = cve.Metrics.CvssMetricV30[0].CvssData.VectorString
		severity = cve.Metrics.CvssMetricV30[0].CvssData.BaseSeverity
	} else if len(cve.Metrics.CvssMetricV2) > 0 {
		cvssScore = cve.Metrics.CvssMetricV2[0].BaseScore
		cvssVector = cve.Metrics.CvssMetricV2[0].CvssData.VectorString
		severity = cve.Metrics.CvssMetricV2[0].CvssData.BaseSeverity
	}

	v.CVSSScore = cvssScore
	v.CVSSVector = cvssVector
	v.Severity = storage.ParseSeverity(severity)
	if v.Severity == "" && cvssScore > 0 {
		v.Severity = storage.CVSStoSeverity(cvssScore)
	}

	for _, w := range cve.Weaknesses {
		for _, d := range w.Description {
			if d.Lang == "en" && strings.HasPrefix(d.Value, "CWE-") {
				v.CWEs = append(v.CWEs, d.Value)
			}
		}
	}

	for _, r := range cve.References {
		v.References = append(v.References, r.URL)
	}

	if pub, err := time.Parse(time.RFC3339, cve.Published); err == nil {
		v.PublishedAt = pub
	}
	if mod, err := time.Parse(time.RFC3339, cve.LastModified); err == nil {
		v.UpdatedAt = mod
	}

	for _, cfg := range cve.Configurations {
		for _, node := range cfg.Nodes {
			for _, cpe := range node.CPEMatch {
				if cpe.Vulnerable {
					comp, versionRange := parseCPE(cpe)
					if comp != "" {
						v.Component = comp
						v.AffectedRange = versionRange
						break
					}
				}
			}
		}
	}

	return v
}

func parseCPE(cpe NVDCPEMatch) (string, string) {
	parts := strings.Split(cpe.CPE23URI, ":")
	if len(parts) < 5 {
		return "", ""
	}

	vendor := parts[3]
	product := parts[4]
	comp := fmt.Sprintf("%s/%s", vendor, product)

	var rangeParts []string
	if cpe.VersionStartIncluding != "" {
		rangeParts = append(rangeParts, ">="+cpe.VersionStartIncluding)
	}
	if cpe.VersionStartExcluding != "" {
		rangeParts = append(rangeParts, ">"+cpe.VersionStartExcluding)
	}
	if cpe.VersionEndIncluding != "" {
		rangeParts = append(rangeParts, "<="+cpe.VersionEndIncluding)
	}
	if cpe.VersionEndExcluding != "" {
		rangeParts = append(rangeParts, "<"+cpe.VersionEndExcluding)
	}

	if len(parts) > 5 && parts[5] != "*" && parts[5] != "-" && len(rangeParts) == 0 {
		rangeParts = append(rangeParts, "="+parts[5])
	}

	return comp, strings.Join(rangeParts, ",")
}

func extractTitle(desc string) string {
	if desc == "" {
		return ""
	}
	desc = strings.TrimSpace(desc)
	if len(desc) > 150 {
		return desc[:147] + "..."
	}
	return desc
}

type GitHubCrawler struct {
	*BaseCrawler
}

func NewGitHubCrawler(cfg SourceConfig, log *logger.Logger, retryer *retry.Retryer) *GitHubCrawler {
	return &GitHubCrawler{BaseCrawler: NewBaseCrawler(cfg.ID, cfg.Name, cfg, log, retryer)}
}

func (c *GitHubCrawler) Fetch(ctx context.Context, fullRefresh bool) ([]*storage.Vulnerability, error) {
	query := `
		query($cursor: String) {
			securityAdvisories(first: 100, after: $cursor, orderBy: {field: UPDATED_AT, direction: DESC}) {
				edges {
					node {
						id
						ghsaId
						summary
						description
						severity
						cvss { score vectorString }
						identifiers { type value }
						publishedAt
						updatedAt
						origin
						permalink
						vulnerabilities(first: 100) {
							edges {
								node {
									package { name ecosystem }
									severity
									vulnerableVersionRange
									firstPatchedVersion { identifier }
								}
							}
						}
						cwes(first: 20) { edges { node { cweId } } }
						references(first: 20) { url }
					}
				}
				pageInfo { hasNextPage endCursor }
			}
		}`

	vulns := make([]*storage.Vulnerability, 0)
	var cursor string
	maxPages := 3

	for page := 0; page < maxPages; page++ {
		select {
		case <-ctx.Done():
			return vulns, ctx.Err()
		default:
		}

		variables := map[string]interface{}{"cursor": nil}
		if cursor != "" {
			variables["cursor"] = cursor
		}

		var result GHResponse
		err := c.retryer.Do(ctx, fmt.Sprintf("github-graphql-%d", page), func(ctx context.Context) error {
			body, _ := json.Marshal(map[string]interface{}{
				"query":     query,
				"variables": variables,
			})

			url := "https://api.github.com/graphql"
			if c.cfg.URL != "" {
				url = c.cfg.URL
			}

			req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
			if err != nil {
				return err
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+c.cfg.APIToken)

			client := &http.Client{Timeout: 30 * time.Second}
			resp, err := client.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()

			respBody, _ := io.ReadAll(resp.Body)
			return json.Unmarshal(respBody, &result)
		})
		if err != nil {
			return vulns, err
		}

		for _, edge := range result.Data.SecurityAdvisories.Edges {
			adv := edge.Node
			for _, vulnEdge := range adv.Vulnerabilities.Edges {
				v := parseGHAdvisory(adv, vulnEdge.Node)
				if v != nil {
					v.Source = "GITHUB"
					vulns = append(vulns, v)
				}
			}
		}

		if !result.Data.SecurityAdvisories.PageInfo.HasNextPage {
			break
		}
		cursor = result.Data.SecurityAdvisories.PageInfo.EndCursor
	}

	return vulns, nil
}

type GHResponse struct {
	Data struct {
		SecurityAdvisories struct {
			Edges []struct {
				Node GHAdvisory
			}
			PageInfo struct {
				HasNextPage bool
				EndCursor   string
			}
		}
	}
}

type GHAdvisory struct {
	ID          string
	GhsaID      string
	Summary     string
	Description string
	Severity    string
	CVSS        struct {
		Score        float64
		VectorString string
	}
	Identifiers []struct {
		Type  string
		Value string
	}
	PublishedAt time.Time
	UpdatedAt   time.Time
	Permalink   string
	Vulnerabilities struct {
		Edges []struct {
			Node GHVuln
		}
	}
	CWEs struct {
		Edges []struct {
			Node struct{ CweId string }
		}
	}
	References []struct{ URL string }
}

type GHVuln struct {
	Package                struct{ Name, Ecosystem string }
	Severity               string
	VulnerableVersionRange string
	FirstPatchedVersion    struct{ Identifier string }
}

func parseGHAdvisory(adv GHAdvisory, vuln GHVuln) *storage.Vulnerability {
	cveID := adv.GhsaID
	for _, id := range adv.Identifiers {
		if id.Type == "CVE" {
			cveID = id.Value
			break
		}
	}

	component := vuln.Package.Name
	if vuln.Package.Ecosystem != "" {
		component = fmt.Sprintf("%s/%s", strings.ToLower(vuln.Package.Ecosystem), component)
	}

	severity := storage.ParseSeverity(vuln.Severity)
	if severity == "" {
		severity = storage.ParseSeverity(adv.Severity)
	}

	v := &storage.Vulnerability{
		ID:            fmt.Sprintf("gh-%s-%s", cveID, vuln.Package.Name),
		CVEID:         cveID,
		Title:         adv.Summary,
		Description:   adv.Description,
		Severity:      severity,
		CVSSScore:     adv.CVSS.Score,
		CVSSVector:    adv.CVSS.VectorString,
		Component:     component,
		AffectedRange: vuln.VulnerableVersionRange,
		FixedVersion:  vuln.FirstPatchedVersion.Identifier,
		PublishedAt:   adv.PublishedAt,
		UpdatedAt:     adv.UpdatedAt,
		DiscoveredAt:  time.Now(),
	}

	for _, ref := range adv.References {
		v.References = append(v.References, ref.URL)
	}
	if adv.Permalink != "" {
		v.References = append(v.References, adv.Permalink)
	}

	for _, cwe := range adv.CWEs.Edges {
		v.CWEs = append(v.CWEs, "CWE-"+cwe.Node.CweId)
	}

	return v
}

type ApacheCrawler struct {
	*BaseCrawler
}

func NewApacheCrawler(cfg SourceConfig, log *logger.Logger, retryer *retry.Retryer) *ApacheCrawler {
	return &ApacheCrawler{BaseCrawler: NewBaseCrawler(cfg.ID, cfg.Name, cfg, log, retryer)}
}

func (c *ApacheCrawler) Fetch(ctx context.Context, fullRefresh bool) ([]*storage.Vulnerability, error) {
	url := c.cfg.URL
	if url == "" {
		url = "https://lists.apache.org/api/rss.rdf?unseen=true&count=50&list=security-announce"
	}

	var body []byte
	err := c.retryer.Do(ctx, "apache-rss", func(ctx context.Context) error {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return err
		}
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		body, _ = io.ReadAll(resp.Body)
		return nil
	})
	if err != nil {
		return nil, err
	}

	var feed RSSFeed
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, err
	}

	vulns := make([]*storage.Vulnerability, 0)
	for _, item := range feed.Channel.Items {
		v := parseApacheItem(item)
		if v != nil {
			v.Source = "APACHE"
			vulns = append(vulns, v)
		}
	}

	return vulns, nil
}

type RSSFeed struct {
	Channel struct {
		Title       string    `xml:"title"`
		Link        string    `xml:"link"`
		Description string    `xml:"description"`
		Items       []RSSItem `xml:"item"`
	} `xml:"channel"`
}

type RSSItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	PubDate     string `xml:"pubDate"`
	GUID        string `xml:"guid"`
}

func parseApacheItem(item RSSItem) *storage.Vulnerability {
	title := strings.TrimSpace(item.Title)
	if !strings.Contains(strings.ToLower(title), "cve") &&
		!strings.Contains(strings.ToLower(title), "vulnerabilit") {
		return nil
	}

	cveID := extractCVE(title + " " + item.Description)
	if cveID == "" {
		cveID = fmt.Sprintf("apache-%s", item.GUID)
	}

	pubTime, _ := time.Parse(time.RFC1123Z, item.PubDate)

	component := "apache/unknown"
	if match := regexp.MustCompile(`\[([^\]]+)\]`).FindStringSubmatch(title); len(match) > 1 {
		component = "apache/" + strings.ToLower(match[1])
	}

	v := &storage.Vulnerability{
		ID:           fmt.Sprintf("apache-%s", cveID),
		CVEID:        cveID,
		Title:        title,
		Description:  item.Description,
		PublishedAt:  pubTime,
		UpdatedAt:    pubTime,
		DiscoveredAt: time.Now(),
		Component:    component,
		References:   []string{item.Link},
	}

	return v
}

func extractCVE(s string) string {
	match := regexp.MustCompile(`CVE-\d{4}-\d{4,}`).FindString(s)
	return match
}

type UbuntuCrawler struct {
	*BaseCrawler
}

func NewUbuntuCrawler(cfg SourceConfig, log *logger.Logger, retryer *retry.Retryer) *UbuntuCrawler {
	return &UbuntuCrawler{BaseCrawler: NewBaseCrawler(cfg.ID, cfg.Name, cfg, log, retryer)}
}

func (c *UbuntuCrawler) Fetch(ctx context.Context, fullRefresh bool) ([]*storage.Vulnerability, error) {
	url := c.cfg.URL
	if url == "" {
		url = "https://ubuntu.com/security/cves.json?limit=50&order=desc&sortby=published"
	}

	var body []byte
	err := c.retryer.Do(ctx, "ubuntu-usn", func(ctx context.Context) error {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return err
		}
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		body, _ = io.ReadAll(resp.Body)
		return nil
	})
	if err != nil {
		return nil, err
	}

	var result UbuntuResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	vulns := make([]*storage.Vulnerability, 0)
	for _, item := range result.CVES {
		v := parseUbuntuCVE(item)
		if v != nil {
			v.Source = "UBUNTU"
			vulns = append(vulns, v)
		}
	}

	return vulns, nil
}

type UbuntuResponse struct {
	CVES []UbuntuCVE `json:"cves"`
}

type UbuntuCVE struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	PublishedAt string  `json:"published_at"`
	CVSSScore   float64 `json:"cvss_score"`
	Severity    string  `json:"severity"`
	Status      string  `json:"status"`
	References  []struct {
		URL string `json:"url"`
	} `json:"references"`
	Packages []struct {
		Name           string `json:"name"`
		SourcePackage  string `json:"source_package"`
		Status         string `json:"status"`
		Description    string `json:"description"`
		UbuntuVersion  string `json:"ubuntu_version"`
	} `json:"packages"`
}

func parseUbuntuCVE(item UbuntuCVE) *storage.Vulnerability {
	v := &storage.Vulnerability{
		ID:           fmt.Sprintf("ubuntu-%s", item.ID),
		CVEID:        item.ID,
		Title:        item.Title,
		Description:  item.Description,
		CVSSScore:    item.CVSSScore,
		Severity:     storage.ParseSeverity(item.Severity),
		DiscoveredAt: time.Now(),
	}

	if v.Severity == "" && v.CVSSScore > 0 {
		v.Severity = storage.CVSStoSeverity(v.CVSSScore)
	}

	if pub, err := time.Parse(time.RFC3339, item.PublishedAt); err == nil {
		v.PublishedAt = pub
		v.UpdatedAt = pub
	}

	for _, pkg := range item.Packages {
		if pkg.SourcePackage != "" {
			v.Component = "ubuntu/" + pkg.SourcePackage
		} else if pkg.Name != "" {
			v.Component = "ubuntu/" + pkg.Name
		}
		break
	}

	for _, ref := range item.References {
		v.References = append(v.References, ref.URL)
	}

	return v
}

type MySQLCrawler struct {
	*BaseCrawler
}

func NewMySQLCrawler(cfg SourceConfig, log *logger.Logger, retryer *retry.Retryer) *MySQLCrawler {
	return &MySQLCrawler{BaseCrawler: NewBaseCrawler(cfg.ID, cfg.Name, cfg, log, retryer)}
}

func (c *MySQLCrawler) Fetch(ctx context.Context, fullRefresh bool) ([]*storage.Vulnerability, error) {
	url := c.cfg.URL
	if url == "" {
		url = "https://dev.mysql.com/doc/relnotes/mysql/8.0/en/"
	}

	var body []byte
	err := c.retryer.Do(ctx, "mysql-relnotes", func(ctx context.Context) error {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return err
		}
		req.Header.Set("User-Agent", "Mozilla/5.0")
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		body, _ = io.ReadAll(resp.Body)
		return nil
	})
	if err != nil {
		return nil, err
	}

	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	vulns := make([]*storage.Vulnerability, 0)
	seen := make(map[string]bool)

	doc.Find("div.itemizedlist, ul, li").Each(func(i int, s *goquery.Selection) {
		text := s.Text()
		cve := extractCVE(text)
		if cve != "" && !seen[cve] {
			seen[cve] = true

			versionMatch := regexp.MustCompile(`MySQL (\d+\.\d+\.\d+)`).FindStringSubmatch(text)
			version := "8.0"
			if len(versionMatch) > 1 {
				version = versionMatch[1]
			}

			severity := storage.SeverityMedium
			if strings.Contains(text, "Critical") || strings.Contains(text, "CRITICAL") {
				severity = storage.SeverityCritical
			} else if strings.Contains(text, "High") || strings.Contains(text, "HIGH") {
				severity = storage.SeverityHigh
			} else if strings.Contains(text, "Low") || strings.Contains(text, "LOW") {
				severity = storage.SeverityLow
			}

			v := &storage.Vulnerability{
				ID:            fmt.Sprintf("mysql-%s", cve),
				CVEID:         cve,
				Title:         fmt.Sprintf("MySQL %s Security Update", version),
				Description:   strings.TrimSpace(text),
				Severity:      severity,
				Component:     "mysql/mysql-server",
				AffectedRange: "<" + version,
				FixedVersion:  version,
				References:    []string{url},
				PublishedAt:   time.Now(),
				UpdatedAt:     time.Now(),
				DiscoveredAt:  time.Now(),
			}
			vulns = append(vulns, v)
		}
	})

	return vulns, nil
}

type PostgreSQLCrawler struct {
	*BaseCrawler
}

func NewPostgreSQLCrawler(cfg SourceConfig, log *logger.Logger, retryer *retry.Retryer) *PostgreSQLCrawler {
	return &PostgreSQLCrawler{BaseCrawler: NewBaseCrawler(cfg.ID, cfg.Name, cfg, log, retryer)}
}

func (c *PostgreSQLCrawler) Fetch(ctx context.Context, fullRefresh bool) ([]*storage.Vulnerability, error) {
	url := c.cfg.URL
	if url == "" {
		url = "https://www.postgresql.org/support/security/"
	}

	var body []byte
	err := c.retryer.Do(ctx, "postgresql-security", func(ctx context.Context) error {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return err
		}
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		body, _ = io.ReadAll(resp.Body)
		return nil
	})
	if err != nil {
		return nil, err
	}

	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	vulns := make([]*storage.Vulnerability, 0)

	doc.Find("table.tblsecurity tr").Each(func(i int, s *goquery.Selection) {
		if i == 0 {
			return
		}
		cols := s.Find("td")
		if cols.Length() < 4 {
			return
		}

		cve := extractCVE(cols.Eq(0).Text())
		if cve == "" {
			return
		}

		affected := cols.Eq(2).Text()
		fixed := cols.Eq(3).Text()
		desc := cols.Eq(1).Text()

		v := &storage.Vulnerability{
			ID:            fmt.Sprintf("pg-%s", cve),
			CVEID:         cve,
			Title:         "PostgreSQL Security Vulnerability",
			Description:   strings.TrimSpace(desc),
			Severity:      storage.SeverityHigh,
			Component:     "postgresql/postgresql",
			AffectedRange: affected,
			FixedVersion:  fixed,
			References:    []string{url},
			PublishedAt:   time.Now(),
			UpdatedAt:     time.Now(),
			DiscoveredAt:  time.Now(),
		}

		if cvss := regexp.MustCompile(`CVSS[: ]+([\d.]+)`).FindStringSubmatch(desc); len(cvss) > 1 {
			if score, err := strconv.ParseFloat(cvss[1], 64); err == nil {
				v.CVSSScore = score
				v.Severity = storage.CVSStoSeverity(score)
			}
		}

		vulns = append(vulns, v)
	})

	return vulns, nil
}

type RedisCrawler struct {
	*BaseCrawler
}

func NewRedisCrawler(cfg SourceConfig, log *logger.Logger, retryer *retry.Retryer) *RedisCrawler {
	return &RedisCrawler{BaseCrawler: NewBaseCrawler(cfg.ID, cfg.Name, cfg, log, retryer)}
}

func (c *RedisCrawler) Fetch(ctx context.Context, fullRefresh bool) ([]*storage.Vulnerability, error) {
	url := c.cfg.URL
	if url == "" {
		url = "https://raw.githubusercontent.com/redis/redis/00b31d3f7f4a061d67becd79b9d513c9ac0695e0/00-RELEASENOTES"
	}

	var body []byte
	err := c.retryer.Do(ctx, "redis-notes", func(ctx context.Context) error {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return err
		}
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		body, _ = io.ReadAll(resp.Body)
		return nil
	})
	if err != nil {
		return nil, err
	}

	content := string(body)
	vulns := make([]*storage.Vulnerability, 0)

	cveRegex := regexp.MustCompile(`(CVE-\d{4}-\d{4,})`)
	versionRegex := regexp.MustCompile(`Redis (\d+\.\d+\.\d+)`)

	for _, line := range strings.Split(content, "\n") {
		if cve := cveRegex.FindString(line); cve != "" {
			v := &storage.Vulnerability{
				ID:            fmt.Sprintf("redis-%s", cve),
				CVEID:         cve,
				Title:         "Redis Security Vulnerability",
				Description:   strings.TrimSpace(line),
				Severity:      storage.SeverityHigh,
				Component:     "redis/redis",
				References:    []string{"https://github.com/redis/redis/security/advisories"},
				PublishedAt:   time.Now(),
				UpdatedAt:     time.Now(),
				DiscoveredAt:  time.Now(),
			}

			if vm := versionRegex.FindStringSubmatch(line); len(vm) > 1 {
				v.FixedVersion = vm[1]
				v.AffectedRange = "<" + vm[1]
			}

			vulns = append(vulns, v)
		}
	}

	return vulns, nil
}

type KafkaCrawler struct {
	*BaseCrawler
}

func NewKafkaCrawler(cfg SourceConfig, log *logger.Logger, retryer *retry.Retryer) *KafkaCrawler {
	return &KafkaCrawler{BaseCrawler: NewBaseCrawler(cfg.ID, cfg.Name, cfg, log, retryer)}
}

func (c *KafkaCrawler) Fetch(ctx context.Context, fullRefresh bool) ([]*storage.Vulnerability, error) {
	url := c.cfg.URL
	if url == "" {
		url = "https://kafka.apache.org/cve-list"
	}

	var body []byte
	err := c.retryer.Do(ctx, "kafka-cve", func(ctx context.Context) error {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return err
		}
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		body, _ = io.ReadAll(resp.Body)
		return nil
	})
	if err != nil {
		return nil, err
	}

	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	vulns := make([]*storage.Vulnerability, 0)

	doc.Find("table tr").Each(func(i int, s *goquery.Selection) {
		if i == 0 {
			return
		}
		cols := s.Find("td")
		if cols.Length() < 3 {
			return
		}

		cve := extractCVE(cols.Eq(0).Text())
		if cve == "" {
			return
		}

		affectStr := cols.Eq(1).Text()
		desc := cols.Eq(2).Text()
		fixed := cols.Eq(3).Text()

		score := 0.0
		severity := storage.SeverityMedium
		if match := regexp.MustCompile(`([\d.]+)/10`).FindStringSubmatch(cols.Eq(0).Text()); len(match) > 1 {
			if s, err := strconv.ParseFloat(match[1], 64); err == nil {
				score = s
				severity = storage.CVSStoSeverity(score)
			}
		}

		v := &storage.Vulnerability{
			ID:            fmt.Sprintf("kafka-%s", cve),
			CVEID:         cve,
			Title:         "Apache Kafka Security Vulnerability",
			Description:   strings.TrimSpace(desc),
			Severity:      severity,
			CVSSScore:     score,
			Component:     "apache/kafka",
			AffectedRange: affectStr,
			FixedVersion:  strings.TrimSpace(fixed),
			References:    []string{url},
			PublishedAt:   time.Now(),
			UpdatedAt:     time.Now(),
			DiscoveredAt:  time.Now(),
		}

		vulns = append(vulns, v)
	})

	return vulns, nil
}
