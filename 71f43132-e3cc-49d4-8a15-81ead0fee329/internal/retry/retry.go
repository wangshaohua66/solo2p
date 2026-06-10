package retry

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/security/vulnmonitor/internal/logger"
)

type Config struct {
	BaseDelay  time.Duration `yaml:"base_delay"`
	MaxDelay   time.Duration `yaml:"max_delay"`
	MaxRetries int           `yaml:"max_retries"`
	Jitter     float64       `yaml:"jitter"`
}

type DeadLetterItem struct {
	ID        string    `json:"id"`
	TaskType  string    `json:"task_type"`
	Payload   []byte    `json:"payload"`
	Error     string    `json:"error"`
	RetryCnt  int       `json:"retry_cnt"`
	CreatedAt time.Time `json:"created_at"`
	LastRetry time.Time `json:"last_retry"`
}

type Retryer struct {
	cfg        Config
	log        *logger.Logger
	deadLetter []DeadLetterItem
	mu         sync.Mutex
}

type RetryableFunc func(context.Context) error

type RetryableHTTPFunc func(context.Context) (*http.Response, error)

func DefaultConfig() Config {
	return Config{
		BaseDelay:  1 * time.Second,
		MaxDelay:   30 * time.Second,
		MaxRetries: 3,
		Jitter:     0.1,
	}
}

func New(cfg Config, log *logger.Logger) *Retryer {
	if log == nil {
		log = logger.Default()
	}
	return &Retryer{
		cfg: cfg,
		log: log,
	}
}

func (r *Retryer) Do(ctx context.Context, taskType string, fn RetryableFunc) error {
	var lastErr error
	for i := 0; i <= r.cfg.MaxRetries; i++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		err := fn(ctx)
		if err == nil {
			if i > 0 {
				r.log.Infof("task %s succeeded after %d retries", taskType, i)
			}
			return nil
		}

		lastErr = err
		if !isRetryable(err) {
			r.log.Warnf("task %s not retryable: %v", taskType, err)
			return err
		}

		if i < r.cfg.MaxRetries {
			delay := r.calculateDelay(i)
			r.log.Warnf("task %s attempt %d/%d failed: %v, retry after %v",
				taskType, i+1, r.cfg.MaxRetries+1, err, delay)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}
	}

	r.log.Errorf("task %s failed after %d attempts: %v", taskType, r.cfg.MaxRetries+1, lastErr)
	return lastErr
}

func (r *Retryer) DoHTTP(ctx context.Context, taskType string, fn RetryableHTTPFunc) (*http.Response, error) {
	var lastErr error
	var lastResp *http.Response

	for i := 0; i <= r.cfg.MaxRetries; i++ {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		resp, err := fn(ctx)
		if err == nil && resp != nil && resp.StatusCode < 500 {
			if i > 0 {
				r.log.Infof("http task %s succeeded after %d retries, status: %d",
					taskType, i, resp.StatusCode)
			}
			return resp, nil
		}

		if resp != nil {
			resp.Body.Close()
		}

		if err != nil {
			lastErr = err
		} else if resp != nil {
			lastErr = fmt.Errorf("http status %d", resp.StatusCode)
		}

		if !isRetryable(lastErr) && (resp == nil || resp.StatusCode >= 500) {
			if resp != nil && resp.StatusCode >= 500 {
			} else {
				r.log.Warnf("http task %s not retryable: %v", taskType, lastErr)
				return nil, lastErr
			}
		}

		if i < r.cfg.MaxRetries {
			delay := r.calculateDelay(i)
			r.log.Warnf("http task %s attempt %d/%d failed: %v, retry after %v",
				taskType, i+1, r.cfg.MaxRetries+1, lastErr, delay)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}
	}

	r.log.Errorf("http task %s failed after %d attempts: %v",
		taskType, r.cfg.MaxRetries+1, lastErr)
	return lastResp, lastErr
}

func (r *Retryer) DoWithDeadLetter(ctx context.Context, taskType string, payload []byte, fn RetryableFunc) error {
	err := r.Do(ctx, taskType, fn)
	if err != nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		item := DeadLetterItem{
			ID:        fmt.Sprintf("%s-%d", taskType, time.Now().UnixNano()),
			TaskType:  taskType,
			Payload:   payload,
			Error:     err.Error(),
			RetryCnt:  r.cfg.MaxRetries + 1,
			CreatedAt: time.Now(),
			LastRetry: time.Now(),
		}
		r.deadLetter = append(r.deadLetter, item)
		r.log.Errorf("moved to dead letter queue: id=%s type=%s", item.ID, taskType)
	}
	return err
}

func (r *Retryer) calculateDelay(attempt int) time.Duration {
	exp := time.Duration(1 << uint(attempt)) * r.cfg.BaseDelay
	if exp > r.cfg.MaxDelay {
		exp = r.cfg.MaxDelay
	}

	if r.cfg.Jitter > 0 {
		jitterRange := float64(exp) * r.cfg.Jitter
		jitter := time.Duration(rand.Float64()*jitterRange*2 - jitterRange)
		exp += jitter
	}

	if exp < r.cfg.BaseDelay {
		exp = r.cfg.BaseDelay
	}

	return exp
}

func isRetryable(err error) bool {
	if err == nil {
		return false
	}

	var temp interface{ Temporary() bool }
	if errors.As(err, &temp) && temp.Temporary() {
		return true
	}

	var timeout interface{ Timeout() bool }
	if errors.As(err, &timeout) && timeout.Timeout() {
		return true
	}

	errStr := err.Error()
	retryableKeywords := []string{
		"timeout", "timed out", "connection refused", "connection reset",
		"temporary failure", "service unavailable", "gateway timeout",
		"bad gateway", "too many requests", "rate limit",
	}

	for _, kw := range retryableKeywords {
		if containsCaseInsensitive(errStr, kw) {
			return true
		}
	}

	return false
}

func containsCaseInsensitive(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 &&
		(len(s) == len(substr) && equalFold(s, substr) ||
			len(s) > len(substr) && containsFold(s, substr)))
}

func equalFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if toLower(a[i]) != toLower(b[i]) {
			return false
		}
	}
	return true
}

func containsFold(s, substr string) bool {
	n := len(substr)
	for i := 0; i <= len(s)-n; i++ {
		if equalFold(s[i:i+n], substr) {
			return true
		}
	}
	return false
}

func toLower(c byte) byte {
	if c >= 'A' && c <= 'Z' {
		return c + 32
	}
	return c
}

func (r *Retryer) GetDeadLetters() []DeadLetterItem {
	r.mu.Lock()
	defer r.mu.Unlock()
	result := make([]DeadLetterItem, len(r.deadLetter))
	copy(result, r.deadLetter)
	return result
}

func (r *Retryer) ClearDeadLetter(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i, item := range r.deadLetter {
		if item.ID == id {
			r.deadLetter = append(r.deadLetter[:i], r.deadLetter[i+1:]...)
			return true
		}
	}
	return false
}

func (r *Retryer) ProcessDeadLetters(ctx context.Context, handler func(DeadLetterItem) error) int {
	items := r.GetDeadLetters()
	processed := 0

	for _, item := range items {
		select {
		case <-ctx.Done():
			return processed
		default:
		}

		err := handler(item)
		if err == nil {
			r.ClearDeadLetter(item.ID)
			processed++
			r.log.Infof("dead letter reprocessed successfully: %s", item.ID)
		} else {
			r.log.Warnf("dead letter reprocess failed: %s, error: %v", item.ID, err)
		}
	}

	return processed
}

func (r *Retryer) CollyErrorHandler(taskType string) func(resp interface{}, err error) {
	return func(resp interface{}, err error) {
		ctx := context.Background()
		_ = r.Do(ctx, fmt.Sprintf("%s-colly-error", taskType), func(ctx context.Context) error {
			return err
		})
	}
}
