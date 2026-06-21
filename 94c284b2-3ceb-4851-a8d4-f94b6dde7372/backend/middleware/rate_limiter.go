package middleware

import (
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)

type visitor struct {
	visits int
	lastSeen time.Time
}

var (
	visitors = make(map[string]*visitor)
	mu       sync.Mutex
)

func RateLimiter(maxRequests int, window time.Duration) echo.MiddlewareFunc {
	go cleanupVisitors()

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ip := c.RealIP()
			mu.Lock()
			v, exists := visitors[ip]
			if !exists {
				visitors[ip] = &visitor{visits: 1, lastSeen: time.Now()}
				mu.Unlock()
				return next(c)
			}
			if time.Since(v.lastSeen) > window {
				v.visits = 1
				v.lastSeen = time.Now()
				mu.Unlock()
				return next(c)
			}
			v.visits++
			v.lastSeen = time.Now()
			if v.visits > maxRequests {
				mu.Unlock()
				return echo.NewHTTPError(429, "Too many requests")
			}
			mu.Unlock()
			return next(c)
		}
	}
}

func cleanupVisitors() {
	for {
		time.Sleep(time.Minute)
		mu.Lock()
		for ip, v := range visitors {
			if time.Since(v.lastSeen) > 3*time.Minute {
				delete(visitors, ip)
			}
		}
		mu.Unlock()
	}
}
