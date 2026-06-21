// Package main groups the CLI helpers shared across subcommands: ANSI colour
// helpers, an ASCII table renderer, a progress bar and a status classifier.
package main

import (
	"fmt"
	"io"
	"os"
	"strings"
	"time"
)

// ANSI colour codes used for status highlighting. They are emitted to stdout
// only when the output is a terminal and --no-color is not set.
const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorBlue   = "\033[34m"
	colorGray   = "\033[90m"
	colorBold   = "\033[1m"
)

var colorEnabled = true

func init() {
	colorEnabled = isTTY(os.Stdout)
}

func isTTY(f *os.File) bool {
	fi, err := f.Stat()
	if err != nil {
		return false
	}
	return (fi.Mode() & os.ModeCharDevice) != 0
}

func paint(c, s string) string {
	if !colorEnabled {
		return s
	}
	return c + s + colorReset
}

// statusClass returns (label, colour) for a pressure-loss reading.
func statusClass(lossPct, margin float64, warnPct, alarmPct float64) (string, string) {
	switch {
	case margin < 0 || lossPct >= alarmPct:
		return "报警", colorRed
	case lossPct >= warnPct:
		return "预警", colorYellow
	default:
		return "正常", colorGreen
	}
}

// urgencyColor maps an urgency string to a colour.
func urgencyColor(u string) string {
	switch strings.ToLower(u) {
	case "critical":
		return colorRed
	case "high":
		return colorYellow
	case "normal":
		return colorGreen
	case "low":
		return colorGray
	default:
		return colorReset
	}
}

// adjustTypeLabel renders a human-readable Chinese label for an adjustment type.
func adjustTypeLabel(t string) string {
	switch t {
	case "pressure":
		return "压力调节"
	case "flow":
		return "流量调节"
	case "valve":
		return "阀门操作"
	default:
		return t
	}
}

// table renders rows of strings as a bordered ASCII table with a header row.
func table(w io.Writer, headers []string, rows [][]string) {
	cols := len(headers)
	width := make([]int, cols)
	for i, h := range headers {
		width[i] = displayWidth(h)
	}
	for _, r := range rows {
		for i := 0; i < cols && i < len(r); i++ {
			if dw := displayWidth(r[i]); dw > width[i] {
				width[i] = dw
			}
		}
	}
	border := "+"
	for _, wd := range width {
		border += strings.Repeat("-", wd+2) + "+"
	}
	fmt.Fprintln(w, border)
	fmt.Fprint(w, "|")
	for i, h := range headers {
		fmt.Fprintf(w, " %s%s |", h, strings.Repeat(" ", width[i]-displayWidth(h)))
	}
	fmt.Fprintln(w)
	fmt.Fprintln(w, border)
	for _, r := range rows {
		fmt.Fprint(w, "|")
		for i := 0; i < cols; i++ {
			cell := ""
			if i < len(r) {
				cell = r[i]
			}
			fmt.Fprintf(w, " %s%s |", cell, strings.Repeat(" ", width[i]-displayWidth(cell)))
		}
		fmt.Fprintln(w)
	}
	fmt.Fprintln(w, border)
}

// displayWidth returns the printable width of s, discounting ANSI escape
// sequences so coloured cells still align.
func displayWidth(s string) int {
	w := 0
	in := false
	for _, r := range s {
		if r == '\033' {
			in = true
			continue
		}
		if in {
			if r == 'm' {
				in = false
			}
			continue
		}
		w++
	}
	return w
}

// progress renders a single-line progress bar to w and returns when done.
// The caller drives it from a separate goroutine by sending progress events.
type progressBar struct {
	w      io.Writer
	total  int
	width  int
	label  string
	done   chan struct{}
}

func newProgressBar(w io.Writer, total int, label string) *progressBar {
	return &progressBar{w: w, total: total, width: 30, label: label, done: make(chan struct{})}
}

func (p *progressBar) update(done int, stationID string) {
	if p.total <= 0 {
		return
	}
	filled := int(float64(p.width) * float64(done) / float64(p.total))
	if filled > p.width {
		filled = p.width
	}
	bar := strings.Repeat("█", filled) + strings.Repeat("░", p.width-filled)
	pct := float64(done) / float64(p.total) * 100
	fmt.Fprintf(p.w, "\r%s [%s] %5.1f%%  %d/%d  %s%s",
		p.label, paint(colorBlue, bar), pct, done, p.total, paint(colorGray, stationID), strings.Repeat(" ", 8))
}

func (p *progressBar) finish() {
	fmt.Fprintln(p.w)
	close(p.done)
}

// countdown prints a simple animated "working" spinner for a short-lived task
// whose duration is unknown, returning when stop is closed.
func countdown(w io.Writer, msg string, stop <-chan struct{}) {
	frames := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
	i := 0
	t := time.NewTicker(80 * time.Millisecond)
	defer t.Stop()
	for {
		select {
		case <-stop:
			fmt.Fprintf(w, "\r\033[K")
			return
		case <-t.C:
			fmt.Fprintf(w, "\r%s %s", paint(colorBlue, frames[i%len(frames)]), msg)
			i++
		}
	}
}

// pageFooter prints pagination guidance when more rows exist.
func pageFooter(w io.Writer, page, size int, total int64) {
	pages := int(total) / size
	if int(total)%size != 0 {
		pages++
	}
	if pages <= 1 {
		return
	}
	fmt.Fprintf(w, "\n%s 第 %d/%d 页（共 %d 条，每页 %d 条）—— 使用 --page 指定页码%s\n",
		paint(colorGray, "›"), page, pages, total, size, colorReset)
}

// parseTimeFlag accepts RFC3339 or "2006-01-02" dates.
func parseTimeFlag(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, nil
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t, nil
	}
	return time.Time{}, fmt.Errorf("invalid time %q (use RFC3339 or YYYY-MM-DD)", s)
}
