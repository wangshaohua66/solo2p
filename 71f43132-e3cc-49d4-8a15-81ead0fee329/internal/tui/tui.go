package tui

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/security/vulnmonitor/internal/logger"
	"github.com/security/vulnmonitor/internal/storage"
)

type AppState struct {
	Sources        []*storage.Source
	Vulns          []*storage.Vulnerability
	Assets         []*storage.Asset
	Stats          map[string]interface{}
	SelectedSource int
	SelectedVuln   int
	SelectedPanel  int
	ShowDetail     bool
	DetailVuln     *storage.Vulnerability
	Filter         string
	RefreshCount   int
	LastRefresh    time.Time
}

type TUIModel struct {
	state     AppState
	store     *storage.Storage
	log       *logger.Logger
	mu        sync.RWMutex
	width     int
	height    int
	loading   bool
	ticker    *time.Ticker
	ctx       context.Context
	cancel    context.CancelFunc
}

var (
	green   = lipgloss.Color("#48bb78")
	yellow  = lipgloss.Color("#ecc94b")
	red     = lipgloss.Color("#f56565")
	blue    = lipgloss.Color("#4299e1")
	purple  = lipgloss.Color("#9f7aea")
	gray    = lipgloss.Color("#718096")
	dark    = lipgloss.Color("#2d3748")
	white   = lipgloss.Color("#f7fafc")

	statusOK   = lipgloss.NewStyle().Foreground(green).Bold(true)
	statusWarn = lipgloss.NewStyle().Foreground(yellow).Bold(true)
	statusErr  = lipgloss.NewStyle().Foreground(red).Bold(true)

	criticalStyle = lipgloss.NewStyle().Foreground(red).Bold(true)
	highStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("#ed8936")).Bold(true)
	mediumStyle   = lipgloss.NewStyle().Foreground(yellow).Bold(true)
	lowStyle      = lipgloss.NewStyle().Foreground(blue).Bold(true)

	titleStyle    = lipgloss.NewStyle().Bold(true).Foreground(purple).Padding(0, 1)
	headerStyle   = lipgloss.NewStyle().Bold(true).Foreground(white).Background(dark).Padding(0, 1)
	panelStyle    = lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(gray)
	selectedStyle = lipgloss.NewStyle().Background(blue).Foreground(white).Bold(true)
	footerStyle   = lipgloss.NewStyle().Foreground(gray).Padding(0, 1)
)

type refreshMsg struct{}
type tickMsg time.Time

func NewModel(store *storage.Storage, log *logger.Logger) *TUIModel {
	ctx, cancel := context.WithCancel(context.Background())
	m := &TUIModel{
		state: AppState{
			Sources:      make([]*storage.Source, 0),
			Vulns:        make([]*storage.Vulnerability, 0),
			Assets:       make([]*storage.Asset, 0),
			Stats:        make(map[string]interface{}),
			SelectedPanel: 0,
		},
		store:  store,
		log:    log,
		ticker: time.NewTicker(5 * time.Second),
		ctx:    ctx,
		cancel: cancel,
	}
	return m
}

func (m *TUIModel) Init() tea.Cmd {
	return tea.Batch(
		m.refreshData(),
		tickCmd(),
	)
}

func tickCmd() tea.Cmd {
	return tea.Tick(5*time.Second, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

func (m *TUIModel) refreshData() tea.Cmd {
	return func() tea.Msg {
		m.loading = true
		ctx := m.ctx

		sources, _ := m.store.GetSources(ctx)
		vulns, _, _ := m.store.GetVulnerabilities(ctx, "", 50, 0)
		assets, _ := m.store.GetAssets(ctx)
		stats, _ := m.store.GetStats(ctx)

		m.mu.Lock()
		m.state.Sources = sources
		m.state.Vulns = vulns
		m.state.Assets = assets
		m.state.Stats = stats
		m.state.RefreshCount++
		m.state.LastRefresh = time.Now()
		m.loading = false
		m.mu.Unlock()

		return refreshMsg{}
	}
}

func (m *TUIModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			m.cancel()
			return m, tea.Quit
		case "h", "left":
			if m.state.ShowDetail {
				m.state.ShowDetail = false
			} else {
				m.state.SelectedPanel = max(0, m.state.SelectedPanel-1)
			}
		case "l", "right":
			m.state.SelectedPanel = min(2, m.state.SelectedPanel+1)
		case "j", "down":
			if m.state.ShowDetail {
				return m, nil
			}
			switch m.state.SelectedPanel {
			case 0:
				m.state.SelectedSource = min(len(m.state.Sources)-1, m.state.SelectedSource+1)
			case 1:
				m.state.SelectedVuln = min(len(m.state.Vulns)-1, m.state.SelectedVuln+1)
			}
		case "k", "up":
			if m.state.ShowDetail {
				return m, nil
			}
			switch m.state.SelectedPanel {
			case 0:
				m.state.SelectedSource = max(0, m.state.SelectedSource-1)
			case 1:
				m.state.SelectedVuln = max(0, m.state.SelectedVuln-1)
			}
		case "enter":
			if m.state.SelectedPanel == 1 && m.state.SelectedVuln < len(m.state.Vulns) {
				m.state.DetailVuln = m.state.Vulns[m.state.SelectedVuln]
				m.state.ShowDetail = true
			} else if m.state.SelectedPanel == 0 && m.state.SelectedSource < len(m.state.Sources) {
				m.state.Filter = m.state.Sources[m.state.SelectedSource].Name
			}
		case "escape":
			m.state.ShowDetail = false
			m.state.Filter = ""
		case "r":
			return m, m.refreshData()
		case "g":
			m.state.SelectedVuln = 0
			m.state.SelectedSource = 0
		case "G":
			m.state.SelectedVuln = max(0, len(m.state.Vulns)-1)
			m.state.SelectedSource = max(0, len(m.state.Sources)-1)
		case "/":
			m.state.Filter = ""
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tickMsg:
		return m, tea.Batch(m.refreshData(), tickCmd())

	case refreshMsg:
		return m, nil
	}

	return m, nil
}

func (m *TUIModel) View() string {
	if m.width == 0 || m.height == 0 {
		return "Initializing..."
	}

	if m.state.ShowDetail {
		return m.renderDetail()
	}

	mainHeight := m.height - 3

	leftWidth := 35
	rightWidth := 35
	midWidth := m.width - leftWidth - rightWidth - 6

	left := m.renderSources(leftWidth, mainHeight)
	mid := m.renderVulns(midWidth, mainHeight)
	right := m.renderStats(rightWidth, mainHeight)

	body := lipgloss.JoinHorizontal(
		lipgloss.Top,
		left,
		mid,
		right,
	)

	footer := m.renderFooter()

	return lipgloss.JoinVertical(lipgloss.Top, body, footer)
}

func (m *TUIModel) renderSources(width, height int) string {
	m.mu.RLock()
	sources := m.state.Sources
	selected := m.state.SelectedSource
	active := m.state.SelectedPanel == 0
	m.mu.RUnlock()

	header := headerStyle.Width(width - 2).Render(fmt.Sprintf(" Data Sources (%d) ", len(sources)))

	items := make([]string, 0)
	for i, src := range sources {
		if i > height-4 {
			break
		}

		var status string
		switch src.Status {
		case storage.SourceStatusOK:
			status = statusOK.Render("●")
		case storage.SourceStatusDegraded:
			status = statusWarn.Render("●")
		default:
			status = statusErr.Render("●")
		}

		name := src.Name
		if len(name) > width-12 {
			name = name[:width-12] + "..."
		}

		line := fmt.Sprintf(" %s %-*s ", status, width-10, name)

		if m.state.Filter != "" && !strings.Contains(src.Name, m.state.Filter) {
			continue
		}

		if active && i == selected {
			items = append(items, selectedStyle.Width(width-2).Render(line))
		} else {
			items = append(items, line)
		}
	}

	for len(items) < height-3 {
		items = append(items, " ")
	}

	content := strings.Join(items, "\n")
	return panelStyle.Width(width).Height(height).Render(
		lipgloss.JoinVertical(lipgloss.Left, header, content),
	)
}

func (m *TUIModel) renderVulns(width, height int) string {
	m.mu.RLock()
	vulns := m.state.Vulns
	selected := m.state.SelectedVuln
	active := m.state.SelectedPanel == 1
	m.mu.RUnlock()

	sort.Slice(vulns, func(i, j int) bool {
		return severityRank(vulns[i].Severity) < severityRank(vulns[j].Severity)
	})

	header := headerStyle.Width(width - 2).Render(fmt.Sprintf(" Latest Alerts (%d) ", len(vulns)))

	items := make([]string, 0)
	for i, v := range vulns {
		if i > height-4 {
			break
		}

		var sevStyle lipgloss.Style
		switch v.Severity {
		case storage.SeverityCritical:
			sevStyle = criticalStyle
		case storage.SeverityHigh:
			sevStyle = highStyle
		case storage.SeverityMedium:
			sevStyle = mediumStyle
		default:
			sevStyle = lowStyle
		}

		sev := sevStyle.Render(fmt.Sprintf("%-8s", v.Severity))
		cve := fmt.Sprintf("%-18s", v.CVEID)
		score := fmt.Sprintf("%.1f", v.CVSSScore)

		availWidth := width - len([]rune(sev)) - len([]rune(cve)) - len([]rune(score)) - 10
		title := v.Title
		if len([]rune(title)) > availWidth {
			runes := []rune(title)
			title = string(runes[:availWidth-3]) + "..."
		}

		line := fmt.Sprintf(" %s %s %s %s ", sev, cve, score, title)

		if active && i == selected {
			items = append(items, selectedStyle.Width(width-2).Render(line))
		} else {
			items = append(items, line)
		}
	}

	for len(items) < height-3 {
		items = append(items, " ")
	}

	content := strings.Join(items, "\n")
	return panelStyle.Width(width).Height(height).Render(
		lipgloss.JoinVertical(lipgloss.Left, header, content),
	)
}

func (m *TUIModel) renderStats(width, height int) string {
	m.mu.RLock()
	stats := m.state.Stats
	assets := m.state.Assets
	m.mu.RUnlock()

	header := headerStyle.Width(width - 2).Render(" Asset Coverage ")

	lines := make([]string, 0)
	lines = append(lines, "")

	if total, ok := stats["total_vulnerabilities"].(int64); ok {
		lines = append(lines, fmt.Sprintf("  Total Vulns:     %d", total))
	}
	if critical, ok := stats["critical"].(int64); ok {
		lines = append(lines, fmt.Sprintf("  %s: %s",
			criticalStyle.Render("Critical      "),
			criticalStyle.Render(fmt.Sprintf("%d", critical))))
	}
	if high, ok := stats["high"].(int64); ok {
		lines = append(lines, fmt.Sprintf("  %s: %s",
			highStyle.Render("High          "),
			highStyle.Render(fmt.Sprintf("%d", high))))
	}
	if medium, ok := stats["medium"].(int64); ok {
		lines = append(lines, fmt.Sprintf("  %s: %s",
			mediumStyle.Render("Medium        "),
			mediumStyle.Render(fmt.Sprintf("%d", medium))))
	}
	if low, ok := stats["low"].(int64); ok {
		lines = append(lines, fmt.Sprintf("  %s: %s",
			lowStyle.Render("Low           "),
			lowStyle.Render(fmt.Sprintf("%d", low))))
	}
	if unnotified, ok := stats["unnotified"].(int64); ok {
		lines = append(lines, fmt.Sprintf("  Unnotified:     %s",
			statusWarn.Render(fmt.Sprintf("%d", unnotified))))
	}

	lines = append(lines, "")
	lines = append(lines, lipgloss.NewStyle().Foreground(purple).Bold(true).Render("  Asset Coverage"))
	lines = append(lines, fmt.Sprintf("  Total Assets:    %d", len(assets)))

	compMap := make(map[string]int)
	for _, a := range assets {
		compMap[a.Component]++
	}

	lines = append(lines, "")
	lines = append(lines, "  Components:")

	count := 0
	for comp, cnt := range compMap {
		if count > height-20 {
			break
		}
		name := comp
		if len([]rune(name)) > width-20 {
			runes := []rune(name)
			name = string(runes[:width-23]) + "..."
		}
		lines = append(lines, fmt.Sprintf("    %-*s x%d", width-24, name, cnt))
		count++
	}

	for len(lines) < height-3 {
		lines = append(lines, " ")
	}

	content := strings.Join(lines, "\n")
	return panelStyle.Width(width).Height(height).Render(
		lipgloss.JoinVertical(lipgloss.Left, header, content),
	)
}

func (m *TUIModel) renderDetail() string {
	v := m.state.DetailVuln
	if v == nil {
		return "No vulnerability selected"
	}

	width := m.width - 4
	height := m.height - 3

	header := headerStyle.Width(width).Render(fmt.Sprintf(" %s - %s ", v.CVEID, v.Severity))

	lines := make([]string, 0)
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("  Title:        %s", v.Title))
	lines = append(lines, fmt.Sprintf("  Source:       %s", v.Source))
	lines = append(lines, fmt.Sprintf("  Severity:     %s (CVSS %.1f)", v.Severity, v.CVSSScore))
	if v.CVSSVector != "" {
		lines = append(lines, fmt.Sprintf("  CVSS Vector:  %s", v.CVSSVector))
	}
	lines = append(lines, fmt.Sprintf("  Component:    %s", v.Component))
	lines = append(lines, fmt.Sprintf("  Affected:     %s", v.AffectedRange))
	if v.FixedVersion != "" {
		lines = append(lines, fmt.Sprintf("  Fixed in:     %s", v.FixedVersion))
	}
	lines = append(lines, fmt.Sprintf("  Published:    %s", v.PublishedAt.Format("2006-01-02 15:04:05")))
	if !v.UpdatedAt.IsZero() {
		lines = append(lines, fmt.Sprintf("  Updated:      %s", v.UpdatedAt.Format("2006-01-02 15:04:05")))
	}
	if len(v.AffectedAssets) > 0 {
		lines = append(lines, fmt.Sprintf("  Affected Assets: %s", strings.Join(v.AffectedAssets, ", ")))
	}
	if len(v.CWEs) > 0 {
		lines = append(lines, fmt.Sprintf("  CWE IDs:      %s", strings.Join(v.CWEs, ", ")))
	}

	lines = append(lines, "")
	lines = append(lines, "  Description:")

	desc := wrapText(v.Description, width-4)
	for _, dline := range desc {
		lines = append(lines, "    "+dline)
	}

	if len(v.References) > 0 {
		lines = append(lines, "")
		lines = append(lines, "  References:")
		for i, ref := range v.References {
			if i >= 10 {
				break
			}
			if len([]rune(ref)) > width-6 {
				runes := []rune(ref)
				ref = string(runes[:width-9]) + "..."
			}
			lines = append(lines, fmt.Sprintf("    %d. %s", i+1, ref))
		}
	}

	for len(lines) < height-2 {
		lines = append(lines, " ")
	}

	lines = append(lines, footerStyle.Render(" Press ESC or 'h' to close, arrow keys to scroll "))

	content := strings.Join(lines, "\n")
	return panelStyle.Width(width).Height(height).Render(
		lipgloss.JoinVertical(lipgloss.Left, header, content),
	)
}

func (m *TUIModel) renderFooter() string {
	m.mu.RLock()
	count := m.state.RefreshCount
	last := m.state.LastRefresh
	filter := m.state.Filter
	m.mu.RUnlock()

	now := time.Now().Format("15:04:05")
	refreshInfo := fmt.Sprintf("Refresh #%d at %s (updated %s ago)",
		count, now, time.Since(last).Round(time.Second))

	keys := "h/j/k/l: nav | Enter: detail | r: refresh | g/G: top/bottom | /: filter | q: quit"

	if filter != "" {
		keys = fmt.Sprintf("Filter: %s | %s", filter, keys)
	}

	return lipgloss.NewStyle().Background(dark).Foreground(white).Width(m.width).Render(
		lipgloss.JoinHorizontal(lipgloss.Center,
			lipgloss.NewStyle().Padding(0, 2).Render(" VulnMonitor TUI "),
			lipgloss.NewStyle().Foreground(yellow).Padding(0, 2).Render(refreshInfo),
			lipgloss.NewStyle().Foreground(gray).Padding(0, 2).Render(keys),
		),
	)
}

func severityRank(s storage.Severity) int {
	switch s {
	case storage.SeverityCritical:
		return 0
	case storage.SeverityHigh:
		return 1
	case storage.SeverityMedium:
		return 2
	default:
		return 3
	}
}

func wrapText(s string, width int) []string {
	words := strings.Fields(s)
	lines := []string{}
	current := ""

	for _, word := range words {
		if len(current)+len(word)+1 > width {
			if current != "" {
				lines = append(lines, current)
			}
			current = word
		} else {
			if current == "" {
				current = word
			} else {
				current += " " + word
			}
		}
	}
	if current != "" {
		lines = append(lines, current)
	}

	return lines
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (m *TUIModel) Close() {
	m.cancel()
	m.ticker.Stop()
}
