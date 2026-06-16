package main

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
	"github.com/rs/zerolog"

	"crossborder-scraper/pipeline"
)

type CaptchaRequest struct {
	Site         string
	CapType      string
	Screenshot   []byte
	ScreenshotPath string
	PageURL      string
	ResponseChan chan string
}

type TUIApp struct {
	app       *tview.Application
	scheduler *Scheduler

	sitesPanel  *tview.TextView
	logPanel    *tview.TextView
	statusBar   *tview.TextView
	progressBar *tview.TextView
	mainRoot    tview.Primitive

	logBuffer    []string
	logBufferMax int
	mu           sync.Mutex

	captchaActive   bool
	captchaRequest  *CaptchaRequest
	captchaModal    *tview.Flex
	captchaInput    *tview.InputField
	captchaInfo     *tview.TextView
	captchaImageBox *tview.TextView

	reportsActive     bool
	reportsModal      *tview.Flex
	reportsList       *tview.List
	reportsDetail     *tview.TextView
	reportsDateInput  *tview.Flex
	reportsStartInput *tview.InputField
	reportsEndInput   *tview.InputField
	reportsStatus     *tview.TextView
	reportsData       []*pipeline.TaskReport
	reportsDir        string
}

var globalTUI *TUIApp

func runTUI(scheduler *Scheduler) error {
	reportsDir := filepath.Join(filepath.Dir(scheduler.config.Global.DBPath), "reports")
	tui := &TUIApp{
		app:          tview.NewApplication(),
		scheduler:    scheduler,
		logBufferMax: 500,
		reportsDir:   reportsDir,
	}

	globalTUI = tui

	tui.setupUI()
	tui.setupCaptchaModal()
	tui.setupReportsModal()

	go tui.updateLoop()

	return tui.app.Run()
}

func ShowCaptchaPopup(req *CaptchaRequest) {
	if globalTUI == nil {
		if req.ResponseChan != nil {
			close(req.ResponseChan)
		}
		return
	}
	globalTUI.app.QueueUpdateDraw(func() {
		globalTUI.showCaptchaModal(req)
	})
}

func (tui *TUIApp) setupCaptchaModal() {
	tui.captchaImageBox = tview.NewTextView().
		SetDynamicColors(true).
		SetWrap(true).
		SetTextAlign(tview.AlignCenter)
	tui.captchaImageBox.SetBorder(true).SetTitle("[::b] [yellow]Captcha Image [::-]")

	tui.captchaInfo = tview.NewTextView().
		SetDynamicColors(true).
		SetWrap(true)
	tui.captchaInfo.SetBorder(true).SetTitle("[::b] [cyan]Information [::-]")

	tui.captchaInput = tview.NewInputField().
		SetLabel("[::b]Enter captcha: [::-]").
		SetFieldWidth(50).
		SetAcceptanceFunc(tview.InputFieldMaxLength(50))
	tui.captchaInput.SetBorder(true).SetTitle("[::b] [green]Input [::-]")

	imagePanel := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(tui.captchaImageBox, 0, 2, false).
		AddItem(tui.captchaInfo, 0, 1, false)

	rightPanel := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(imagePanel, 0, 3, false).
		AddItem(tui.captchaInput, 5, 1, true)

	tui.captchaModal = tview.NewFlex().SetDirection(tview.FlexColumn).
		AddItem(tview.NewBox(), 0, 1, false).
		AddItem(rightPanel, 80, 1, true).
		AddItem(tview.NewBox(), 0, 1, false)

	tui.captchaModal.SetBorder(true).
		SetTitle("[::b] [red] CAPTCHA REQUIRED - ACTION NEEDED [::-]").
		SetBorderPadding(1, 1, 2, 2)

	tui.captchaInput.SetDoneFunc(func(key tcell.Key) {
		if key == tcell.KeyEnter {
			text := tui.captchaInput.GetText()
			tui.closeCaptchaModal(text)
		}
		if key == tcell.KeyEscape {
			tui.closeCaptchaModal("")
		}
	})
}

func (tui *TUIApp) showCaptchaModal(req *CaptchaRequest) {
	if tui.captchaActive {
		return
	}

	tui.mu.Lock()
	tui.captchaActive = true
	tui.captchaRequest = req
	tui.mu.Unlock()

	if req.ScreenshotPath == "" && len(req.Screenshot) > 0 {
		tmpPath := fmt.Sprintf("/tmp/captcha_%s_%d.png", req.Site, time.Now().Unix())
		if err := os.WriteFile(tmpPath, req.Screenshot, 0644); err == nil {
			req.ScreenshotPath = tmpPath
		}
	}

	imgInfo := "[yellow]Terminal cannot display images directly.\n\n"
	imgInfo += "[white]Please open the following file in your browser:\n"
	imgInfo += fmt.Sprintf("[green]%s[-]\n\n", req.ScreenshotPath)
	imgInfo += "[white]Or view the base64 data:\n"
	b64Data := base64.StdEncoding.EncodeToString(req.Screenshot)
	if len(b64Data) > 200 {
		b64Data = b64Data[:200] + "..."
	}
	imgInfo += fmt.Sprintf("[gray]data:image/png;base64,%s[-]\n", b64Data)

	tui.captchaImageBox.SetText(imgInfo)

	infoText := fmt.Sprintf(
		"[cyan]Site:[white] %s\n\n[cyan]Type:[white] %s\n\n[cyan]Page:[white] %s\n\n\n[yellow]Instructions:[-]\n  1. Open the screenshot file in your browser\n  2. Identify the captcha text\n  3. Type it below and press Enter\n  4. Press ESC to skip and auto-refresh",
		req.Site, req.CapType, req.PageURL,
	)
	tui.captchaInfo.SetText(infoText)

	tui.captchaInput.SetText("")
	tui.app.SetRoot(tui.captchaModal, true).SetFocus(tui.captchaInput)
}

func (tui *TUIApp) closeCaptchaModal(response string) {
	tui.mu.Lock()
	req := tui.captchaRequest
	tui.captchaActive = false
	tui.captchaRequest = nil
	tui.mu.Unlock()

	tui.app.SetRoot(tui.mainRoot, true)

	if req != nil && req.ResponseChan != nil {
		select {
		case req.ResponseChan <- response:
		default:
		}
		close(req.ResponseChan)
	}
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

	tui.mainRoot = mainFlex
	tui.app.SetRoot(mainFlex, true)

	tui.app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		if tui.reportsActive {
			switch event.Key() {
			case tcell.KeyEscape:
				tui.closeReportsModal()
				return nil
			}
			return event
		}

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
			case 'r', 'R':
				tui.showReportsModal()
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
	sb.WriteString(" [gray]r/R[-] Query Reports\n")
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

func (tui *TUIApp) setupReportsModal() {
	defaultStart := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
	defaultEnd := time.Now().Format("2006-01-02")

	tui.reportsStartInput = tview.NewInputField().
		SetLabel("[::b]Start Date (YYYY-MM-DD): [::-]").
		SetText(defaultStart).
		SetFieldWidth(20).
		SetAcceptanceFunc(tview.InputFieldMaxLength(10))
	tui.reportsStartInput.SetBorder(true).SetTitle("[::b] [cyan]Start Date [::-]")

	tui.reportsEndInput = tview.NewInputField().
		SetLabel("[::b]End Date (YYYY-MM-DD): [::-]").
		SetText(defaultEnd).
		SetFieldWidth(20).
		SetAcceptanceFunc(tview.InputFieldMaxLength(10))
	tui.reportsEndInput.SetBorder(true).SetTitle("[::b] [cyan]End Date [::-]")

	tui.reportsStatus = tview.NewTextView().
		SetDynamicColors(true).
		SetWrap(true)
	tui.reportsStatus.SetBorder(true).SetTitle("[::b] [yellow]Status [::-]")

	dateButtons := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(tui.reportsStartInput, 5, 1, true).
		AddItem(tui.reportsEndInput, 5, 1, false)

	queryButton := tview.NewButton("[::b] [green]Query by Date Range [::-]").
		SetSelectedFunc(func() {
			tui.doReportsQuery()
		})

	recentButton := tview.NewButton("[::b] [blue]Show Recent Reports [::-]").
		SetSelectedFunc(func() {
			tui.doReportsRecent()
		})

	buttonRow := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(queryButton, 3, 1, false).
		AddItem(recentButton, 3, 1, false).
		AddItem(tui.reportsStatus, 0, 2, false)

	leftPanel := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(dateButtons, 10, 1, true).
		AddItem(buttonRow, 0, 2, false)

	tui.reportsList = tview.NewList().
		ShowSecondaryText(true).
		SetMainTextColor(tcell.ColorWhite).
		SetSelectedBackgroundColor(tcell.ColorDarkCyan).
		SetSelectedTextColor(tcell.ColorWhite)
	tui.reportsList.SetBorder(true).SetTitle("[::b] [cyan]Reports [::-] (↑↓ select, Enter view, e export, ESC close)")

	tui.reportsDetail = tview.NewTextView().
		SetDynamicColors(true).
		SetWrap(true).
		SetScrollable(true)
	tui.reportsDetail.SetBorder(true).SetTitle("[::b] [green]Report Detail [::-]")

	rightPanel := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(tui.reportsList, 0, 1, false).
		AddItem(tui.reportsDetail, 0, 1, false)

	content := tview.NewFlex().SetDirection(tview.FlexColumn).
		AddItem(tview.NewBox(), 2, 1, false).
		AddItem(leftPanel, 40, 1, true).
		AddItem(rightPanel, 0, 3, false).
		AddItem(tview.NewBox(), 2, 1, false)

	tui.reportsModal = tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(tview.NewBox(), 2, 1, false).
		AddItem(content, 0, 1, true).
		AddItem(tview.NewBox(), 2, 1, false)

	tui.reportsModal.SetBorder(true).
		SetTitle("[::b] [magenta] HISTORY REPORTS QUERY [::-]").
		SetBorderPadding(1, 1, 2, 2)

	tui.reportsList.SetSelectedFunc(func(index int, mainText, secondaryText string, shortcut rune) {
		if index >= 0 && index < len(tui.reportsData) {
			tui.showReportDetail(tui.reportsData[index])
		}
	})

	tui.reportsList.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEnter:
			idx := tui.reportsList.GetCurrentItem()
			if idx >= 0 && idx < len(tui.reportsData) {
				tui.showReportDetail(tui.reportsData[idx])
			}
			return nil
		case tcell.KeyRune:
			switch event.Rune() {
			case 'e', 'E':
				idx := tui.reportsList.GetCurrentItem()
				if idx >= 0 && idx < len(tui.reportsData) {
					tui.doReportsExport([]*pipeline.TaskReport{tui.reportsData[idx]})
				}
				return nil
			}
		}
		return event
	})

	tui.reportsStartInput.SetDoneFunc(func(key tcell.Key) {
		if key == tcell.KeyEnter || key == tcell.KeyTab {
			tui.app.SetFocus(tui.reportsEndInput)
		}
	})

	tui.reportsEndInput.SetDoneFunc(func(key tcell.Key) {
		if key == tcell.KeyEnter {
			tui.doReportsQuery()
		} else if key == tcell.KeyTab {
			tui.app.SetFocus(tui.reportsList)
		}
	})
}

func (tui *TUIApp) showReportsModal() {
	if tui.captchaActive {
		tui.reportsStatus.SetText("[red]Cannot open reports while captcha is active[-]")
		return
	}

	tui.mu.Lock()
	tui.reportsActive = true
	tui.mu.Unlock()

	defaultStart := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
	defaultEnd := time.Now().Format("2006-01-02")
	tui.reportsStartInput.SetText(defaultStart)
	tui.reportsEndInput.SetText(defaultEnd)
	tui.reportsList.Clear()
	tui.reportsDetail.SetText("")
	tui.reportsStatus.SetText("[cyan]Enter date range and press Enter, or click 'Show Recent Reports'[-]")
	tui.reportsData = nil

	tui.app.SetRoot(tui.reportsModal, true).SetFocus(tui.reportsStartInput)
}

func (tui *TUIApp) closeReportsModal() {
	tui.mu.Lock()
	tui.reportsActive = false
	tui.mu.Unlock()

	tui.app.SetRoot(tui.mainRoot, true)
}

func (tui *TUIApp) doReportsQuery() {
	startStr := tui.reportsStartInput.GetText()
	endStr := tui.reportsEndInput.GetText()

	var start, end time.Time
	var err error

	if startStr != "" {
		start, err = time.Parse("2006-01-02", startStr)
		if err != nil {
			tui.reportsStatus.SetText(fmt.Sprintf("[red]Invalid start date: %s[-]", err.Error()))
			return
		}
		start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	}

	if endStr != "" {
		end, err = time.Parse("2006-01-02", endStr)
		if err != nil {
			tui.reportsStatus.SetText(fmt.Sprintf("[red]Invalid end date: %s[-]", err.Error()))
			return
		}
		end = time.Date(end.Year(), end.Month(), end.Day(), 23, 59, 59, 999999999, end.Location())
	}

	tui.reportsStatus.SetText("[yellow]Querying reports...[-]")
	tui.app.ForceDraw()

	reports, err := tui.scheduler.store.QueryReportsByDateRange(start, end)
	if err != nil {
		tui.reportsStatus.SetText(fmt.Sprintf("[red]Query failed: %s[-]", err.Error()))
		return
	}

	tui.reportsData = reports
	tui.updateReportsList(reports)
	tui.reportsStatus.SetText(fmt.Sprintf("[green]Found %d report(s)[-]", len(reports)))
	tui.app.SetFocus(tui.reportsList)
}

func (tui *TUIApp) doReportsRecent() {
	tui.reportsStatus.SetText("[yellow]Loading recent reports...[-]")
	tui.app.ForceDraw()

	reports, err := tui.scheduler.store.GetRecentReports(50)
	if err != nil {
		tui.reportsStatus.SetText(fmt.Sprintf("[red]Query failed: %s[-]", err.Error()))
		return
	}

	tui.reportsData = reports
	tui.updateReportsList(reports)
	tui.reportsStatus.SetText(fmt.Sprintf("[green]Showing %d most recent report(s)[-]", len(reports)))
	tui.app.SetFocus(tui.reportsList)
}

func (tui *TUIApp) updateReportsList(reports []*pipeline.TaskReport) {
	tui.reportsList.Clear()

	if len(reports) == 0 {
		tui.reportsList.AddItem("[gray]No reports found[-]", "", 0, nil)
		return
	}

	for i, r := range reports {
		var statusColor string
		switch r.Status {
		case "completed":
			statusColor = "[green]"
		case "partial":
			statusColor = "[yellow]"
		case "failed":
			statusColor = "[red]"
		default:
			statusColor = "[white]"
		}

		mainText := fmt.Sprintf("%s%s[-]  |  %s  |  Sites: %d/%d  |  Items: %d",
			statusColor,
			strings.ToUpper(r.Status),
			r.StartTime.Format("2006-01-02 15:04"),
			r.SuccessCount,
			r.TotalSites,
			r.TotalProducts,
		)

		secText := fmt.Sprintf("  ID: %s  |  Duration: %s",
			r.TaskID,
			r.EndTime.Sub(r.StartTime).Round(time.Second).String(),
		)

		shortcut := rune('0' + (i+1)%10)
		if i+1 > 9 {
			shortcut = 0
		}
		tui.reportsList.AddItem(mainText, secText, shortcut, nil)
	}
}

func (tui *TUIApp) showReportDetail(r *pipeline.TaskReport) {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("[::u][cyan]Task ID:[::-][-] %s\n\n", r.TaskID))
	sb.WriteString(fmt.Sprintf("[::u][cyan]Status:[::-][-] "))
	switch r.Status {
	case "completed":
		sb.WriteString("[green]COMPLETED[-]\n\n")
	case "partial":
		sb.WriteString("[yellow]PARTIAL[-]\n\n")
	case "failed":
		sb.WriteString("[red]FAILED[-]\n\n")
	default:
		sb.WriteString(fmt.Sprintf("%s\n\n", r.Status))
	}

	sb.WriteString(fmt.Sprintf("[::u][cyan]Start Time:[::-][-] %s\n", r.StartTime.Format("2006-01-02 15:04:05")))
	sb.WriteString(fmt.Sprintf("[::u][cyan]End Time:[::-][-]   %s\n", r.EndTime.Format("2006-01-02 15:04:05")))
	sb.WriteString(fmt.Sprintf("[::u][cyan]Duration:[::-][-]   %s\n\n", r.EndTime.Sub(r.StartTime).Round(time.Second).String()))

	sb.WriteString(fmt.Sprintf("[::u][cyan]Total Sites:[::-][-] %d\n", r.TotalSites))
	sb.WriteString(fmt.Sprintf("  [green]Success: %d[-]  |  [red]Failed: %d[-]  |  [gray]Skipped: %d[-]\n",
		r.SuccessCount, r.FailCount, r.SkipCount))
	sb.WriteString(fmt.Sprintf("[::u][cyan]Total Products:[::-][-] %d\n\n", r.TotalProducts))

	if len(r.SiteReports) > 0 {
		sb.WriteString("[::u][cyan]Site Reports:[::-][-]\n\n")
		for _, sr := range r.SiteReports {
			var siteStatus string
			if sr.FailCount > 0 && sr.SuccessCount == 0 {
				siteStatus = "[red]FAILED[-]"
			} else if sr.FailCount > 0 {
				siteStatus = "[yellow]PARTIAL[-]"
			} else {
				siteStatus = "[green]OK[-]"
			}
			sb.WriteString(fmt.Sprintf("  %-12s %s  |  Items: %5d  |  Duration: %s\n",
				sr.SiteName,
				siteStatus,
				sr.TotalItems,
				time.Duration(sr.DurationMs*int64(time.Millisecond)).Round(time.Millisecond).String(),
			))
			if sr.ErrorMsg != "" {
				sb.WriteString(fmt.Sprintf("    [red]Error: %s[-]\n", sr.ErrorMsg))
			}
		}
	}

	sb.WriteString("\n\n[gray]Press 'e' to export this report as JSON[-]")

	tui.reportsDetail.SetText(sb.String())
	tui.reportsDetail.ScrollToBeginning()
}

func (tui *TUIApp) doReportsExport(reports []*pipeline.TaskReport) {
	if len(reports) == 0 {
		tui.reportsStatus.SetText("[yellow]No reports selected for export[-]")
		return
	}

	tui.reportsStatus.SetText("[yellow]Exporting reports...[-]")
	tui.app.ForceDraw()

	paths, err := tui.scheduler.store.BatchExportReportsJSON(reports, tui.reportsDir)
	if err != nil {
		tui.reportsStatus.SetText(fmt.Sprintf("[red]Export failed: %s[-]", err.Error()))
		return
	}

	if len(paths) == 0 {
		tui.reportsStatus.SetText("[yellow]No reports were exported[-]")
		return
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("[green]Successfully exported %d report(s):[-]\n\n", len(paths)))
	for _, p := range paths {
		sb.WriteString(fmt.Sprintf("  [cyan]%s[-]\n", p))
	}
	tui.reportsStatus.SetText(sb.String())
}
