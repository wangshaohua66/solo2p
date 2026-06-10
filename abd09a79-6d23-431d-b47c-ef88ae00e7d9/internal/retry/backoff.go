package retry

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"bankrupt-monitor/internal/model"
	"bankrupt-monitor/internal/store"

	"go.uber.org/zap"
)

type Backoff struct {
	baseDelay   time.Duration
	maxDelay    time.Duration
	multiplier  float64
	maxAttempts int
	logger      *zap.Logger
	store       *store.Store
	dlDir       string
	mu          sync.Mutex
}

type RetryableFunc func(ctx context.Context) error

type ErrorType string

const (
	ErrNetwork ErrorType = "network"
	ErrHTTP5xx ErrorType = "http_5xx"
	ErrHTTP4xx ErrorType = "http_4xx"
	ErrParse   ErrorType = "parse"
	ErrTimeout ErrorType = "timeout"
	ErrUnknown ErrorType = "unknown"
)

func NewBackoff(baseDelay, maxDelay time.Duration, multiplier float64, maxAttempts int, store *store.Store, dlDir string, log *zap.Logger) *Backoff {
	return &Backoff{
		baseDelay:   baseDelay,
		maxDelay:    maxDelay,
		multiplier:  multiplier,
		maxAttempts: maxAttempts,
		logger:      log,
		store:       store,
		dlDir:       dlDir,
	}
}

func (b *Backoff) Do(ctx context.Context, fn RetryableFunc, rawURL, sourceCourt, rawHTML string, isParseError bool) error {
	if isParseError {
		b.saveDeadLetter(rawURL, sourceCourt, ErrParse, "parse error", rawHTML, 0, 1, nil)
		return fmt.Errorf("parse error, sent to dead letter")
	}

	var lastErr error
	for attempt := 0; attempt < b.maxAttempts; attempt++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		lastErr = fn(ctx)
		if lastErr == nil {
			return nil
		}

		if !IsRetryable(lastErr) {
			b.saveDeadLetter(rawURL, sourceCourt, classifyError(lastErr), lastErr.Error(), rawHTML, 0, attempt+1, lastErr)
			return lastErr
		}

		if attempt < b.maxAttempts-1 {
			delay := b.nextDelay(attempt)
			b.logger.Warn("retryable error, backing off",
				zap.String("url", rawURL),
				zap.Int("attempt", attempt+1),
				zap.Duration("delay", delay),
				zap.Error(lastErr),
			)
			select {
			case <-time.After(delay):
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}

	b.saveDeadLetter(rawURL, sourceCourt, classifyError(lastErr), lastErr.Error(), rawHTML, 0, b.maxAttempts, lastErr)
	return fmt.Errorf("exhausted %d retries: %w", b.maxAttempts, lastErr)
}

func (b *Backoff) nextDelay(attempt int) time.Duration {
	delay := b.baseDelay
	for i := 0; i < attempt; i++ {
		delay = time.Duration(float64(delay) * b.multiplier)
		if delay > b.maxDelay {
			delay = b.maxDelay
			break
		}
	}
	jitter := time.Duration(rand.Int63n(int64(delay / 2)))
	return delay + jitter
}

func IsRetryable(err error) bool {
	if err == nil {
		return false
	}
	errStr := strings.ToLower(err.Error())

	var netErr net.Error
	if errors.As(err, &netErr) {
		if netErr.Timeout() {
			return true
		}
	}

	var opErr *net.OpError
	if errors.As(err, &opErr) {
		return true
	}

	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		if urlErr.Timeout() || strings.Contains(strings.ToLower(urlErr.Error()), "temporary") {
			return true
		}
	}

	retryableKeywords := []string{
		"eof", "connection reset", "connection refused", "broken pipe",
		"timeout", "temporary", "502", "503", "504", "500",
		"too many open files", "dns", "no such host",
	}
	for _, kw := range retryableKeywords {
		if strings.Contains(errStr, kw) {
			return true
		}
	}

	return false
}

func classifyError(err error) ErrorType {
	if err == nil {
		return ErrUnknown
	}
	s := strings.ToLower(err.Error())

	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return ErrTimeout
	}

	switch {
	case strings.Contains(s, " 500 "), strings.Contains(s, " 502 "), strings.Contains(s, " 503 "), strings.Contains(s, " 504 "):
		return ErrHTTP5xx
	case strings.Contains(s, " 400 "), strings.Contains(s, " 401 "), strings.Contains(s, " 403 "), strings.Contains(s, " 404 "):
		return ErrHTTP4xx
	case strings.Contains(s, "eof"), strings.Contains(s, "connection"), strings.Contains(s, "dns"), strings.Contains(s, "broken pipe"):
		return ErrNetwork
	case strings.Contains(s, "timeout"):
		return ErrTimeout
	default:
		return ErrUnknown
	}
}

func (b *Backoff) saveDeadLetter(rawURL, sourceCourt string, errType ErrorType, errMsg, rawHTML string, httpStatus, attemptCount int, srcErr error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	dl := &model.DeadLetter{
		URL:           rawURL,
		SourceCourt:   sourceCourt,
		ErrorType:     string(errType),
		ErrorMessage:  errMsg,
		RawHTML:       rawHTML,
		HTTPStatus:    httpStatus,
		AttemptCount:  attemptCount,
		LastAttemptAt: time.Now(),
	}
	if srcErr != nil {
		dl.Context = fmt.Sprintf("%T", srcErr)
	}

	if b.store != nil {
		if err := b.store.AddDeadLetter(dl); err != nil {
			b.logger.Error("save dead letter to db failed", zap.Error(err), zap.String("url", rawURL))
			b.saveToFile(dl)
		}
	} else {
		b.saveToFile(dl)
	}
}

func (b *Backoff) saveToFile(dl *model.DeadLetter) {
	if b.dlDir == "" {
		return
	}
	if err := os.MkdirAll(b.dlDir, 0755); err != nil {
		b.logger.Error("create dead letter dir failed", zap.Error(err))
		return
	}

	ts := time.Now().Format("20060102_150405")
	fname := fmt.Sprintf("%s_%s.html", dl.ErrorType, ts)
	fpath := filepath.Join(b.dlDir, fname)
	content := fmt.Sprintf("<!-- URL: %s -->\n<!-- Error: %s: %s -->\n%s", dl.URL, dl.ErrorType, dl.ErrorMessage, dl.RawHTML)
	if err := os.WriteFile(fpath, []byte(content), 0644); err != nil {
		b.logger.Error("write dead letter file failed", zap.Error(err))
	}
}
