package main

import (
	"encoding/base64"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
	"github.com/rs/zerolog"
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
}

var globalTUI *TUIApp

func runTUI(scheduler *Scheduler) error {
	tui := &TUIApp{
		app:          tview.NewApplication(),
		scheduler:    scheduler,
		logBufferMax: 500,
	}

	globalTUI = tui

	tui.setupUI()
	tui.setupCaptchaModal()

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
