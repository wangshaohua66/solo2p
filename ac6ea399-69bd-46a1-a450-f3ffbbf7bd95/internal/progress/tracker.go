package progress

import (
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorBlue   = "\033[34m"
	colorCyan   = "\033[36m"
	colorGray   = "\033[37m"
)

type Stats struct {
	TotalFiles    int64
	TotalBytes    int64
	DoneFiles     int64
	DoneBytes     int64
	FailedFiles   int64
	SkippedFiles  int64
	ConflictFiles int64
	DeletedFiles  int64
	Errors        []FileError
	startTime     time.Time
	lastUpdate    time.Time
	lastBytes     int64
	speedWindow   []speedSample
}

type speedSample struct {
	bytes    int64
	duration time.Duration
}

type FileError struct {
	Key       string    `json:"key"`
	Error     string    `json:"error"`
	Timestamp time.Time `json:"timestamp"`
}

type Tracker struct {
	mu          sync.Mutex
	stats       Stats
	quiet       bool
	verbose     bool
	jsonMode    bool
	lastRender  time.Time
	currentLine string
	cancelCh    chan struct{}
	running     bool
}

func NewTracker(quiet, verbose, jsonMode bool) *Tracker {
	return &Tracker{
		stats: Stats{
			startTime:   time.Now(),
			lastUpdate:  time.Now(),
			speedWindow: make([]speedSample, 0, 30),
		},
		quiet:    quiet,
		verbose:  verbose,
		jsonMode: jsonMode,
		cancelCh: make(chan struct{}),
	}
}

func (t *Tracker) SetTotal(files, bytes int64) {
	t.mu.Lock()
	defer t.mu.Unlock()
	atomic.StoreInt64(&t.stats.TotalFiles, files)
	atomic.StoreInt64(&t.stats.TotalBytes, bytes)
}

func (t *Tracker) AddProgress(files, bytes int64) {
	t.mu.Lock()
	defer t.mu.Unlock()

	atomic.AddInt64(&t.stats.DoneFiles, files)
	newBytes := atomic.AddInt64(&t.stats.DoneBytes, bytes)

	now := time.Now()
	elapsed := now.Sub(t.stats.lastUpdate)
	if elapsed >= 500*time.Millisecond {
		delta := newBytes - t.stats.lastBytes
		t.stats.speedWindow = append(t.stats.speedWindow, speedSample{
			bytes:    delta,
			duration: elapsed,
		})
		if len(t.stats.speedWindow) > 30 {
			t.stats.speedWindow = t.stats.speedWindow[1:]
		}
		t.stats.lastUpdate = now
		t.stats.lastBytes = newBytes
	}
}

func (t *Tracker) AddFailed(key string, err error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	atomic.AddInt64(&t.stats.FailedFiles, 1)
	t.stats.Errors = append(t.stats.Errors, FileError{
		Key:       key,
		Error:     err.Error(),
		Timestamp: time.Now(),
	})
}

func (t *Tracker) AddSkipped(n int64) {
	atomic.AddInt64(&t.stats.SkippedFiles, n)
}

func (t *Tracker) AddConflict(n int64) {
	atomic.AddInt64(&t.stats.ConflictFiles, n)
}

func (t *Tracker) AddDeleted(n int64) {
	atomic.AddInt64(&t.stats.DeletedFiles, n)
}

func (t *Tracker) GetStats() Stats {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.stats
}

func (t *Tracker) Start() {
	t.mu.Lock()
	t.stats.startTime = time.Now()
	t.stats.lastUpdate = time.Now()
	t.running = true
	t.mu.Unlock()

	if !t.quiet && !t.jsonMode {
		go t.renderLoop()
	}
}

func (t *Tracker) Stop() {
	t.mu.Lock()
	t.running = false
	t.mu.Unlock()

	select {
	case t.cancelCh <- struct{}{}:
	default:
	}

	if !t.quiet && !t.jsonMode {
		fmt.Println()
	}
}

func (t *Tracker) renderLoop() {
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			t.mu.Lock()
			if !t.running {
				t.mu.Unlock()
				return
			}
			t.mu.Unlock()
			t.render()
		case <-t.cancelCh:
			return
		}
	}
}

func (t *Tracker) render() {
	stats := t.GetStats()

	total := atomic.LoadInt64(&stats.TotalFiles)
	done := atomic.LoadInt64(&stats.DoneFiles)
	totalBytes := atomic.LoadInt64(&stats.TotalBytes)
	doneBytes := atomic.LoadInt64(&stats.DoneBytes)
	failed := atomic.LoadInt64(&stats.FailedFiles)

	var percent float64
	if total > 0 {
		percent = float64(done) / float64(total) * 100
	}
	if totalBytes > 0 {
		percent = float64(doneBytes) / float64(totalBytes) * 100
	}
	if percent > 100 {
		percent = 100
	}

	width := 40
	filled := int(float64(width) * percent / 100)
	if filled > width {
		filled = width
	}

	bar := strings.Repeat("█", filled) + strings.Repeat("░", width-filled)

	speed := t.avgSpeed()
	eta := t.eta(doneBytes, totalBytes, speed)

	line := fmt.Sprintf("\r%s[%s]%s %s%.1f%%%s | %s%s/%s files%s | %s%s/%s bytes%s | %s%s/s%s | ETA: %s%s%s",
		colorCyan, bar, colorReset,
		colorGreen, percent, colorReset,
		colorBlue, formatCount(done), formatCount(total), colorReset,
		colorBlue, formatBytes(doneBytes), formatBytes(totalBytes), colorReset,
		colorYellow, formatBytes(int64(speed)), colorReset,
		colorPurple(), formatDuration(eta), colorReset,
	)

	if failed > 0 {
		line += fmt.Sprintf(" | %s%d failed%s", colorRed, failed, colorReset)
	}

	fmt.Print(line)
}

func colorPurple() string { return "\033[35m" }

func (t *Tracker) avgSpeed() float64 {
	t.mu.Lock()
	defer t.mu.Unlock()

	var totalBytes int64
	var totalDuration time.Duration
	for _, s := range t.stats.speedWindow {
		totalBytes += s.bytes
		totalDuration += s.duration
	}

	if totalDuration == 0 {
		return 0
	}
	return float64(totalBytes) / totalDuration.Seconds()
}

func (t *Tracker) eta(done, total int64, speed float64) time.Duration {
	if speed <= 0 {
		return 0
	}
	remaining := total - done
	if remaining <= 0 {
		return 0
	}
	seconds := float64(remaining) / speed
	return time.Duration(seconds) * time.Second
}

func formatBytes(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for m := n / unit; m >= unit; m /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(n)/float64(div), "KMGTPE"[exp])
}

func formatCount(n int64) string {
	if n >= 1000000 {
		return fmt.Sprintf("%.1fM", float64(n)/1000000)
	}
	if n >= 1000 {
		return fmt.Sprintf("%.1fK", float64(n)/1000)
	}
	return fmt.Sprintf("%d", n)
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm%02ds", int(d.Minutes()), int(d.Seconds())%60)
	}
	return fmt.Sprintf("%dh%02dm", int(d.Hours()), int(d.Minutes())%60)
}

func (s *Stats) Elapsed() time.Duration {
	return time.Since(s.startTime)
}

func (s *Stats) SuccessRate() float64 {
	total := atomic.LoadInt64(&s.DoneFiles) + atomic.LoadInt64(&s.FailedFiles)
	if total == 0 {
		return 100
	}
	return float64(atomic.LoadInt64(&s.DoneFiles)) / float64(total) * 100
}

func (s *Stats) AvgSpeedBPS() float64 {
	elapsed := s.Elapsed().Seconds()
	if elapsed <= 0 {
		return 0
	}
	return float64(atomic.LoadInt64(&s.DoneBytes)) / elapsed
}

func (t *Tracker) PrintSummary() {
	if t.quiet {
		return
	}

	stats := t.GetStats()
	elapsed := stats.Elapsed()
	speed := stats.AvgSpeedBPS()

	if t.jsonMode {
		return
	}

	fmt.Println()
	fmt.Println(strings.Repeat("=", 60))
	fmt.Printf("%sSync Summary%s\n", colorCyan, colorReset)
	fmt.Println(strings.Repeat("-", 60))
	fmt.Printf("  %sTotal Files:%s     %s\n", colorBlue, colorReset, formatCount(atomic.LoadInt64(&stats.TotalFiles)))
	fmt.Printf("  %sCompleted:%s       %s\n", colorGreen, colorReset, formatCount(atomic.LoadInt64(&stats.DoneFiles)))
	fmt.Printf("  %sFailed:%s          %s\n", colorRed, colorReset, formatCount(atomic.LoadInt64(&stats.FailedFiles)))
	fmt.Printf("  %sSkipped:%s         %s\n", colorYellow, colorReset, formatCount(atomic.LoadInt64(&stats.SkippedFiles)))
	fmt.Printf("  %sConflicts:%s       %s\n", colorYellow, colorReset, formatCount(atomic.LoadInt64(&stats.ConflictFiles)))
	fmt.Printf("  %sDeleted:%s         %s\n", colorYellow, colorReset, formatCount(atomic.LoadInt64(&stats.DeletedFiles)))
	fmt.Println(strings.Repeat("-", 60))
	fmt.Printf("  %sTotal Size:%s      %s\n", colorBlue, colorReset, formatBytes(atomic.LoadInt64(&stats.TotalBytes)))
	fmt.Printf("  %sTransferred:%s     %s\n", colorGreen, colorReset, formatBytes(atomic.LoadInt64(&stats.DoneBytes)))
	fmt.Printf("  %sAvg Speed:%s       %s/s\n", colorCyan, colorReset, formatBytes(int64(speed)))
	fmt.Printf("  %sElapsed:%s         %s\n", colorCyan, colorReset, formatDuration(elapsed))
	fmt.Printf("  %sSuccess Rate:%s    %.1f%%\n", colorGreen, colorReset, stats.SuccessRate())

	if len(stats.Errors) > 0 {
		fmt.Println(strings.Repeat("-", 60))
		fmt.Printf("%sErrors (%d):%s\n", colorRed, len(stats.Errors), colorReset)
		limit := len(stats.Errors)
		if limit > 10 {
			limit = 10
		}
		for i := 0; i < limit; i++ {
			e := stats.Errors[i]
			fmt.Printf("  - %s: %s\n", e.Key, e.Error)
		}
		if len(stats.Errors) > 10 {
			fmt.Printf("  ... and %d more\n", len(stats.Errors)-10)
		}
	}
	fmt.Println(strings.Repeat("=", 60))
}
