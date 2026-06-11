package tui

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/rs/zerolog"

	"github.com/remote-sensing/sentinel-cli/internal/store"
	"github.com/remote-sensing/sentinel-cli/internal/types"
)

var (
	green   = lipgloss.Color("#04B575")
	red     = lipgloss.Color("#FF5555")
	yellow  = lipgloss.Color("#F1FA8C")
	blue    = lipgloss.Color("#569CD6")
	purple  = lipgloss.Color("#C586C0")
	gray    = lipgloss.Color("#808080")
	bg      = lipgloss.Color("#1E1E1E")
	lightBg = lipgloss.Color("#2D2D30")
)

type DashboardModel struct {
	store         *store.BoltStore
	logger        zerolog.Logger
	stats         types.PipelineStats
	tasks         []*types.Task
	filteredTasks []*types.Task
	selectedTask  int
	filterMode    string
	table         table.Model
	viewport      viewport.Model
	progress      progress.Model
	width         int
	height        int
	lastUpdate    time.Time
	refreshChan   chan tea.Msg
	mu            sync.RWMutex
	showHelp      bool
	scrollOffset  int
	maxTasks      int
}

type StatsMsg struct {
	Stats types.PipelineStats
	Tasks []*types.Task
}

type TickMsg time.Time

func NewDashboardModel(store *store.BoltStore, logger zerolog.Logger) *DashboardModel {
	columns := []table.Column{
		{Title: "ID", Width: 18},
		{Title: "Type", Width: 18},
		{Title: "Status", Width: 10},
		{Title: "Progress", Width: 12},
		{Title: "ETA", Width: 10},
		{Title: "Rate", Width: 10},
		{Title: "File", Width: 30},
	}
	rows := []table.Row{}
	t := table.New(
		table.WithColumns(columns),
		table.WithRows(rows),
		table.WithFocused(true),
		table.WithHeight(15),
	)
	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(blue).
		BorderBottom(true).
		Bold(true)
	s.Selected = s.Selected.
		Foreground(lipgloss.Color("229")).
		Background(blue).
		Bold(false)
	t.SetStyles(s)
	p := progress.New(
		progress.WithDefaultGradient(),
		progress.WithWidth(40),
	)
	vp := viewport.New(80, 10)
	vp.Style = lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(blue).
		Padding(1, 2)
	return &DashboardModel{
		store:       store,
		logger:      logger,
		table:       t,
		viewport:    vp,
		progress:    p,
		refreshChan: make(chan tea.Msg, 10),
		filterMode:  "all",
		showHelp:    true,
		maxTasks:    50,
	}
}

func (m *DashboardModel) Init() tea.Cmd {
	return tea.Batch(
		tickCmd(),
		m.refreshData(),
	)
}

func tickCmd() tea.Cmd {
	return tea.Tick(2*time.Second, func(t time.Time) tea.Msg {
		return TickMsg(t)
	})
}

func (m *DashboardModel) refreshData() tea.Cmd {
	return func() tea.Msg {
		stats, err := m.store.GetStats()
		if err != nil {
			m.logger.Error().Err(err).Msg("failed to get stats")
			return StatsMsg{}
		}
		tasks, err := m.store.ListTasks("", m.maxTasks, 0)
		if err != nil {
			m.logger.Error().Err(err).Msg("failed to get tasks")
			return StatsMsg{Stats: stats}
		}
		return StatsMsg{Stats: stats, Tasks: tasks}
	}
}

func (m *DashboardModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.table.SetWidth(msg.Width - 4)
		m.table.SetHeight(msg.Height - 15)
		m.viewport.Width = msg.Width - 4
		m.viewport.Height = 8
		m.progress.Width = msg.Width - 20
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "s", "S":
			m.filterMode = "failed"
			m.applyFilter()
		case "a", "A":
			m.filterMode = "all"
			m.applyFilter()
		case "p", "P":
			m.filterMode = "pending"
			m.applyFilter()
		case "r":
			if m.selectedTask >= 0 && m.selectedTask < len(m.filteredTasks) {
				task := m.filteredTasks[m.selectedTask]
				if task.Status == types.TaskStatusFailed || task.Status == types.TaskStatusDead {
					err := m.store.ResetTask(task.ID, false)
					if err != nil {
						m.logger.Error().Err(err).Str("task_id", task.ID).Msg("failed to reset task")
					} else {
						m.logger.Info().Str("task_id", task.ID).Msg("task reset for retry")
					}
				}
			}
			return m, m.refreshData()
		case "R":
			if m.selectedTask >= 0 && m.selectedTask < len(m.filteredTasks) {
				task := m.filteredTasks[m.selectedTask]
				err := m.store.ResetTask(task.ID, true)
				if err != nil {
					m.logger.Error().Err(err).Str("task_id", task.ID).Msg("failed to force reset task")
				}
			}
			return m, m.refreshData()
		case "up", "k":
			if m.selectedTask > 0 {
				m.selectedTask--
				tableHeight := m.table.Height()
				if tableHeight > 0 && m.selectedTask < m.scrollOffset {
					m.scrollOffset = m.selectedTask
				}
				m.refreshTableRows()
			}
		case "down", "j":
			if m.selectedTask < len(m.filteredTasks)-1 {
				m.selectedTask++
				tableHeight := m.table.Height()
				if tableHeight > 0 && m.selectedTask >= m.scrollOffset+tableHeight {
					m.scrollOffset = m.selectedTask - tableHeight + 1
				}
				m.refreshTableRows()
			}
		case "h", "?":
			m.showHelp = !m.showHelp
		case "home", "g":
			m.selectedTask = 0
			m.scrollOffset = 0
			m.refreshTableRows()
		case "end", "G":
			m.selectedTask = len(m.filteredTasks) - 1
			tableHeight := m.table.Height()
			if tableHeight > 0 {
				m.scrollOffset = max(0, len(m.filteredTasks)-tableHeight)
			}
			m.refreshTableRows()
		}
	case tea.MouseMsg:
		const (
			wheelUp   = 4
			wheelDown = 5
		)
		mev := msg
		tableHeight := m.table.Height()
		if tableHeight <= 0 {
			tableHeight = 10
		}
		if mev.Button == wheelUp {
			if m.scrollOffset > 0 {
				m.scrollOffset--
				m.refreshTableRows()
			}
		} else if mev.Button == wheelDown {
			maxOffset := max(0, len(m.filteredTasks)-tableHeight)
			if m.scrollOffset < maxOffset {
				m.scrollOffset++
				m.refreshTableRows()
			}
		}
	case TickMsg:
		return m, tea.Batch(tickCmd(), m.refreshData())
	case StatsMsg:
		m.stats = msg.Stats
		m.tasks = msg.Tasks
		m.applyFilter()
		m.lastUpdate = time.Now()
	case progress.FrameMsg:
		progressModel, cmd := m.progress.Update(msg)
		m.progress = progressModel.(progress.Model)
		return m, cmd
	}
	m.table, cmd = m.table.Update(msg)
	m.viewport, _ = m.viewport.Update(msg)
	return m, cmd
}

func (m *DashboardModel) applyFilter() {
	m.filteredTasks = m.filteredTasks[:0]
	switch m.filterMode {
	case "failed":
		for _, t := range m.tasks {
			if t.Status == types.TaskStatusFailed || t.Status == types.TaskStatusDead {
				m.filteredTasks = append(m.filteredTasks, t)
			}
		}
	case "pending":
		for _, t := range m.tasks {
			if t.Status == types.TaskStatusPending {
				m.filteredTasks = append(m.filteredTasks, t)
			}
		}
	default:
		m.filteredTasks = append(m.filteredTasks, m.tasks...)
	}
	sort.Slice(m.filteredTasks, func(i, j int) bool {
		return m.filteredTasks[i].CreatedAt.After(m.filteredTasks[j].CreatedAt)
	})
	m.refreshTableRows()
	if m.selectedTask >= len(m.filteredTasks) {
		m.selectedTask = max(0, len(m.filteredTasks)-1)
	}
	if m.scrollOffset > max(0, len(m.filteredTasks)-10) {
		m.scrollOffset = max(0, len(m.filteredTasks)-10)
	}
}

func (m *DashboardModel) refreshTableRows() {
	tableHeight := 10
	if h := m.table.Height(); h > 0 {
		tableHeight = h
	}
	start := m.scrollOffset
	end := start + tableHeight
	if start < 0 {
		start = 0
		m.scrollOffset = 0
	}
	if end > len(m.filteredTasks) {
		end = len(m.filteredTasks)
	}
	visibleTasks := m.filteredTasks[start:end]
	rows := make([]table.Row, len(visibleTasks))
	for i, task := range visibleTasks {
		progressPct := 0
		if task.Progress.TotalChunks > 0 {
			progressPct = task.Progress.CurrentChunk * 100 / task.Progress.TotalChunks
		}
		eta := "-"
		if task.Progress.AverageRate > 0 && task.Progress.BytesTotal > 0 {
			remaining := task.Progress.BytesTotal - task.Progress.BytesProcessed
			seconds := float64(remaining) / 1024 / 1024 / task.Progress.AverageRate
			if seconds > 0 {
				eta = formatDuration(time.Duration(seconds * float64(time.Second)))
			}
		}
		rate := "-"
		if task.Progress.AverageRate > 0 {
			rate = fmt.Sprintf("%.1f MB/s", task.Progress.AverageRate)
		}
		fileName := task.InputPath
		if len(fileName) > 28 {
			fileName = "..." + fileName[len(fileName)-25:]
		}
		rows[i] = table.Row{
			task.ID,
			string(task.Type),
			formatStatus(task.Status),
			fmt.Sprintf("%d%%", progressPct),
			eta,
			rate,
			fileName,
		}
	}
	m.table.SetRows(rows)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func formatStatus(status types.TaskStatus) string {
	switch status {
	case types.TaskStatusDone:
		return lipgloss.NewStyle().Foreground(green).Render("✓ DONE")
	case types.TaskStatusRunning:
		return lipgloss.NewStyle().Foreground(blue).Render("⚡ RUN")
	case types.TaskStatusPending:
		return lipgloss.NewStyle().Foreground(yellow).Render("⏳ PEND")
	case types.TaskStatusFailed:
		return lipgloss.NewStyle().Foreground(red).Render("✗ FAIL")
	case types.TaskStatusDead:
		return lipgloss.NewStyle().Foreground(purple).Render("☠ DEAD")
	default:
		return string(status)
	}
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	} else if d < time.Hour {
		return fmt.Sprintf("%dm%02ds", int(d.Minutes()), int(d.Seconds())%60)
	} else {
		return fmt.Sprintf("%dh%02dm", int(d.Hours()), int(d.Minutes())%60)
	}
}

func (m *DashboardModel) View() string {
	var sb strings.Builder
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("229")).
		Background(blue).
		Padding(0, 2).
		MarginBottom(1)
	sb.WriteString(titleStyle.Render("SENTINEL-CLI DASHBOARD"))
	sb.WriteString("\n\n")
	statsBar := m.renderStatsBar()
	sb.WriteString(statsBar)
	sb.WriteString("\n\n")
	filterInfo := fmt.Sprintf("Filter: %s | Tasks: %d/%d",
		m.filterMode, len(m.filteredTasks), len(m.tasks))
	sb.WriteString(lipgloss.NewStyle().Foreground(gray).Render(filterInfo))
	sb.WriteString("\n\n")
	if m.filterMode != "all" && len(m.filteredTasks) == 0 {
		noTasksStyle := lipgloss.NewStyle().
			Foreground(yellow).
			Bold(true).
			Align(lipgloss.Center).
			Width(m.width - 4)
		sb.WriteString(noTasksStyle.Render("无匹配任务 | No matching tasks"))
		sb.WriteString("\n\n")
	} else {
		sb.WriteString(m.table.View())
	}
	sb.WriteString("\n\n")
	if m.selectedTask >= 0 && m.selectedTask < len(m.filteredTasks) {
		task := m.filteredTasks[m.selectedTask]
		sb.WriteString(m.renderTaskDetail(task))
		sb.WriteString("\n")
	}
	if m.showHelp {
		sb.WriteString(m.renderHelp())
	}
	footer := fmt.Sprintf("Last update: %s | Press q to quit",
		m.lastUpdate.Format("15:04:05"))
	sb.WriteString(lipgloss.NewStyle().Foreground(gray).Render(footer))
	return sb.String()
}

func (m *DashboardModel) renderStatsBar() string {
	stats := m.stats
	statBox := func(label string, value int, color lipgloss.Color) string {
		style := lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(color).
			Padding(1, 3).
			Align(lipgloss.Center)
		labelStyle := lipgloss.NewStyle().Foreground(gray).Render(label)
		valueStyle := lipgloss.NewStyle().Foreground(color).Bold(true).Render(fmt.Sprintf("%d", value))
		return style.Render(fmt.Sprintf("%s\n%s", valueStyle, labelStyle))
	}
	boxes := []string{
		statBox("Total", stats.TotalTasks, blue),
		statBox("Pending", stats.PendingTasks, yellow),
		statBox("Running", stats.RunningTasks, blue),
		statBox("Done", stats.CompletedTasks, green),
		statBox("Failed", stats.FailedTasks, red),
		statBox("Dead", stats.DeadTasks, purple),
	}
	throughputBox := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(green).
		Padding(1, 3).
		Align(lipgloss.Center).
		Render(fmt.Sprintf("%s\n%s",
			lipgloss.NewStyle().Foreground(green).Bold(true).Render(fmt.Sprintf("%.1f MB/s", stats.ThroughputMBs)),
			lipgloss.NewStyle().Foreground(gray).Render("Throughput")))
	boxes = append(boxes, throughputBox)
	uptime := formatDuration(stats.Uptime)
	uptimeBox := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(gray).
		Padding(1, 3).
		Align(lipgloss.Center).
		Render(fmt.Sprintf("%s\n%s",
			lipgloss.NewStyle().Foreground(gray).Bold(true).Render(uptime),
			lipgloss.NewStyle().Foreground(gray).Render("Uptime")))
	boxes = append(boxes, uptimeBox)
	return lipgloss.JoinHorizontal(lipgloss.Top, boxes...)
}

func (m *DashboardModel) renderTaskDetail(task *types.Task) string {
	style := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(blue).
		Padding(1, 2).
		Width(m.width - 4)
	var sb strings.Builder
	sb.WriteString(lipgloss.NewStyle().Bold(true).Foreground(blue).Render("Task Details"))
	sb.WriteString("\n\n")
	progressPct := 0.0
	if task.Progress.TotalChunks > 0 {
		progressPct = float64(task.Progress.CurrentChunk) / float64(task.Progress.TotalChunks)
	}
	bar := m.progress.ViewAs(progressPct)
	sb.WriteString(fmt.Sprintf("Progress: %s\n", bar))
	sb.WriteString("\n")
	info := fmt.Sprintf(
		"  ID:         %s\n"+
			"  Type:       %s\n"+
			"  Status:     %s\n"+
			"  Input:      %s\n"+
			"  Output:     %s\n"+
			"  Created:    %s\n",
		task.ID,
		task.Type,
		formatStatus(task.Status),
		task.InputPath,
		task.OutputPath,
		task.CreatedAt.Format("2006-01-02 15:04:05"),
	)
	if task.StartedAt != nil {
		info += fmt.Sprintf("  Started:    %s\n", task.StartedAt.Format("2006-01-02 15:04:05"))
	}
	if task.CompletedAt != nil {
		duration := task.CompletedAt.Sub(*task.StartedAt)
		info += fmt.Sprintf("  Completed:  %s (took %s)\n",
			task.CompletedAt.Format("2006-01-02 15:04:05"),
			formatDuration(duration))
	}
	info += fmt.Sprintf(
		"  Chunks:     %d/%d\n"+
			"  Retries:    %d/%d\n",
		task.Progress.CurrentChunk,
		task.Progress.TotalChunks,
		task.RetryCount,
		task.MaxRetries,
	)
	sb.WriteString(info)
	if len(task.Errors) > 0 {
		sb.WriteString("\n")
		sb.WriteString(lipgloss.NewStyle().Foreground(red).Bold(true).Render("  Error History:"))
		sb.WriteString("\n")
		for i, err := range task.Errors {
			if i >= 3 {
				remaining := len(task.Errors) - 3
				sb.WriteString(fmt.Sprintf("    ... and %d more errors\n", remaining))
				break
			}
			sb.WriteString(fmt.Sprintf("    [%s] %s: %s\n",
				err.Timestamp.Format("15:04:05"),
				lipgloss.NewStyle().Foreground(red).Render(string(err.ErrorCode)),
				err.Message))
			if i == len(task.Errors)-1 {
				category, suggestions, _ := m.store.ClassifyFailure(task.ID)
				sb.WriteString(fmt.Sprintf("    Category: %s\n",
					lipgloss.NewStyle().Foreground(yellow).Render(category)))
				sb.WriteString("    Suggestions:\n")
				for _, s := range suggestions {
					sb.WriteString(fmt.Sprintf("      • %s\n", s))
				}
			}
		}
	}
	return style.Render(sb.String())
}

func (m *DashboardModel) renderHelp() string {
	style := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(gray).
		Padding(1, 2).
		Width(m.width - 4).
		Foreground(gray)
	var sb strings.Builder
	sb.WriteString(lipgloss.NewStyle().Bold(true).Foreground(gray).Render("Keyboard Shortcuts"))
	sb.WriteString("\n\n")
	keys := []struct {
		key  string
		desc string
	}{
		{"↑/k", "Move up"},
		{"↓/j", "Move down"},
		{"g/home", "Go to top"},
		{"G/end", "Go to bottom"},
		{"a", "Show all tasks"},
		{"s", "Show failed tasks"},
		{"p", "Show pending tasks"},
		{"r", "Retry selected (soft reset)"},
		{"R", "Force retry selected (clear errors)"},
		{"h/?", "Toggle help"},
		{"q/ctrl+c", "Quit"},
	}
	for _, k := range keys {
		keyStyle := lipgloss.NewStyle().Foreground(blue).Bold(true)
		sb.WriteString(fmt.Sprintf("  %-12s %s\n", keyStyle.Render(k.key), k.desc))
	}
	return style.Render(sb.String())
}

func StartDashboard(store *store.BoltStore, logger zerolog.Logger) error {
	p := tea.NewProgram(
		NewDashboardModel(store, logger),
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)
	_, err := p.Run()
	return err
}
