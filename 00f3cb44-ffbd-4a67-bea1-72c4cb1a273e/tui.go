package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
	"github.com/rs/zerolog"
)

type TUIApp struct {
	app       *tview.Application
	scheduler *Scheduler

	sitesPanel  *tview.TextView
	logPanel    *tview.TextView
	statusBar   *tview.TextView
	progressBar *tview.TextView

	logBuffer    []string
	logBufferMax int
	mu           *tview.Box
}

func runTUI(scheduler *Scheduler) error {
	tui := &TUIApp{
		app:          tview.NewApplication(),
		scheduler:    scheduler,
		logBufferMax: 500,
	}

	tui.setupUI()

	go tui.updateLoop()

	return tui.app.Run()
}

func (tui *TUIApp) setupUI() {
	siteNames := []string{"Amazon", "eBay", "Walmart", "AliExpress", "Target", "BestBuy"}

	tui.sitesPanel = tview.NewTextView().
		SetDynamicColors(true).
		SetRegions(true).
		SetWrap(false)
	tui.sitesPanel.SetBorder(true).SetTitle("[::b] Platform Status [::-]")

	tui.logPanel = tview.NewTextView().
		SetDynamicColors(true).
		SetRegions(true).
		SetWrap(false).
		SetScrollable(true)
	tui.logPanel.SetBorder(true).SetTitle("[::b] Real-time Logs [::-]")

	tui.statusBar = tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignLeft)
	tui.statusBar.SetBorder(false)

	tui.progressBar = tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignLeft)
	tui.progressBar.SetBorder(false)

	rightPanel := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(tui.logPanel, 0, 3, false).
		AddItem(tui.progressBar, 3, 1, false).
		AddItem(tui.statusBar, 1, 1, false)

	mainFlex := tview.NewFlex().SetDirection(tview.FlexColumn).
		AddItem(tui.sitesPanel, 30, 1, false).
		AddItem(rightPanel, 0, 3, false)

	tui.app.SetRoot(mainFlex, true)

	tui.app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyCtrlP:
			if tui.scheduler.isPaused() {
				tui.scheduler.Resume()
			} else {
				tui.scheduler.Pause()
			}
			return nil
		case tcell.KeyCtrlQ:
			tui.app.Stop()
			return nil
		case tcell.KeyRune:
			switch event.Rune() {
			case 'q', 'Q':
				tui.app.Stop()
				return nil
			case 'p', 'P':
				if tui.scheduler.isPaused() {
					tui.scheduler.Resume()
				} else {
					tui.scheduler.Pause()
				}
				return nil
			}
		}
		return event
	})

	tui.updateSitesPanel(siteNames)
	tui.updateStatusBar()
	tui.updateProgressBar()
}

func (tui *TUIApp) updateLoop() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		tui.app.QueueUpdateDraw(func() {
			tui.updateAll()
		})
	}
}

func (tui *TUIApp) updateAll() {
	tui.updateSitesPanel([]string{"Amazon", "eBay", "Walmart", "AliExpress", "Target", "BestBuy"})
	tui.updateStatusBar()
	tui.updateProgressBar()
}

func (tui *TUIApp) updateSitesPanel(siteNames []string) {
	var sb strings.Builder

	task := tui.scheduler.GetActiveTask()

	for i, name := range siteNames {
		status := "idle"
		statusColor := "[gray]"

		if task != nil {
			if s, ok := task.SiteStatus[strings.ToLower(name)]; ok {
				status = s
				switch s {
				case "crawling":
					statusColor = "[yellow]"
				case "done":
					statusColor = "[green]"
				case "error":
					statusColor = "[red]"
				case "pending":
					statusColor = "[gray]"
				}
			}
		}

		statusDot := "●"
		sb.WriteString(fmt.Sprintf(" %s%s %s[-:-:-]\n", statusColor, statusDot, name))
		sb.WriteString(fmt.Sprintf("   Status: %s%s[-:-:-]\n", statusColor, status))

		if i < len(siteNames)-1 {
			sb.WriteString("\n")
		}
	}

	sb.WriteString("\n\n[::u]Shortcuts[::-]\n")
	sb.WriteString(" [gray]p/P[-] Pause/Resume\n")
	sb.WriteString(" [gray]q/Q[-] Quit\n")

	tui.sitesPanel.SetText(sb.String())
}

func (tui *TUIApp) updateStatusBar() {
	task := tui.scheduler.GetActiveTask()
	paused := tui.scheduler.isPaused()

	products, _ := tui.scheduler.store.CountProducts()

	var statusText string
	if paused {
		statusText = "[yellow][::b]PAUSED[::-][-]  "
	} else if task != nil {
		statusText = "[green][::b]RUNNING[::-][-] "
	} else {
		statusText = "[cyan][::b]IDLE[::-][-]    "
	}

	now := time.Now().Format("15:04:05")
	dbSize, _ := tui.scheduler.store.GetDBSize()
	dbSizeMB := float64(dbSize) / 1024 / 1024

	text := fmt.Sprintf(
		"%s | Total Products: [yellow]%d[-] | DB Size: [yellow]%.1f MB[-] | Time: %s",
		statusText,
		products,
		dbSizeMB,
		now,
	)

	tui.statusBar.SetText(text)
}

func (tui *TUIApp) updateProgressBar() {
	task := tui.scheduler.GetActiveTask()

	if task == nil {
		tui.progressBar.SetText("[gray]No active task. Next scheduled run in 6 hours.[-]")
		return
	}

	progress := task.Progress
	if progress < 0 {
		progress = 0
	}
	if progress > 1 {
		progress = 1
	}

	barWidth := 40
	filled := int(progress * float64(barWidth))
	empty := barWidth - filled

	bar := "["
	bar += strings.Repeat("█", filled)
	bar += strings.Repeat("░", empty)
	bar += "]"

	elapsed := time.Since(task.StartTime)
	percent := int(progress * 100)

	text := fmt.Sprintf(
		"[cyan]Progress[::-] %s [green]%d%%[-]  |  Items: [yellow]%d[-]  |  Elapsed: %s",
		bar,
		percent,
		task.TotalItems,
		elapsed.Round(time.Second),
	)

	tui.progressBar.SetText(text)
}

func (tui *TUIApp) addLog(level zerolog.Level, msg string) {
	now := time.Now().Format("15:04:05")
	var coloredMsg string

	switch level {
	case zerolog.ErrorLevel, zerolog.FatalLevel, zerolog.PanicLevel:
		coloredMsg = fmt.Sprintf("[red]%s ERROR[-] %s", now, msg)
	case zerolog.WarnLevel:
		coloredMsg = fmt.Sprintf("[yellow]%s WARN[-]  %s", now, msg)
	case zerolog.InfoLevel:
		coloredMsg = fmt.Sprintf("[green]%s INFO[-]  %s", now, msg)
	case zerolog.DebugLevel:
		coloredMsg = fmt.Sprintf("[gray]%s DEBUG[-] %s", now, msg)
	default:
		coloredMsg = fmt.Sprintf("[white]%s[-] %s", now, msg)
	}

	tui.logBuffer = append(tui.logBuffer, coloredMsg)
	if len(tui.logBuffer) > tui.logBufferMax {
		tui.logBuffer = tui.logBuffer[len(tui.logBuffer)-tui.logBufferMax:]
	}

	tui.app.QueueUpdateDraw(func() {
		text := strings.Join(tui.logBuffer, "\n")
		tui.logPanel.SetText(text)
		tui.logPanel.ScrollToEnd()
	})
}
