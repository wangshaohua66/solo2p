package scraper

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

type CaptchaType string

const (
	CaptchaTypeHCaptcha  CaptchaType = "hcaptcha"
	CaptchaTypeRecaptcha CaptchaType = "recaptcha"
	CaptchaTypeSlider    CaptchaType = "slider"
	CaptchaTypeImage     CaptchaType = "image"
	CaptchaTypeUnknown   CaptchaType = "unknown"
)

type CaptchaDetector struct {
	selectors map[CaptchaType][]string
}

type CaptchaRequest struct {
	ID         string      `json:"id"`
	Site       string      `json:"site"`
	Type       CaptchaType `json:"type"`
	Screenshot string      `json:"screenshot"`
	PageURL    string      `json:"page_url"`
	CreatedAt  time.Time   `json:"created_at"`
}

type CaptchaResponse struct {
	ID       string    `json:"id"`
	Solved   bool      `json:"solved"`
	Solution string    `json:"solution"`
	Operator string    `json:"operator"`
	SolvedAt time.Time `json:"solved_at"`
}

type CaptchaHandler struct {
	port           int
	upgrader       websocket.Upgrader
	connections    map[string]*websocket.Conn
	pendingReqs    map[string]chan *CaptchaResponse
	mu             sync.Mutex
	screenshotsDir string
	tuiSolver      func(site string, capType CaptchaType, screenshot []byte, pageURL string) (string, error)
}

func NewCaptchaDetector() *CaptchaDetector {
	return &CaptchaDetector{
		selectors: map[CaptchaType][]string{
			CaptchaTypeHCaptcha: {
				"iframe[src*='hcaptcha.com']",
				".h-captcha",
				"#hcaptcha",
			},
			CaptchaTypeRecaptcha: {
				"iframe[src*='recaptcha.net']",
				"iframe[src*='google.com/recaptcha']",
				".g-recaptcha",
				"#recaptcha",
			},
			CaptchaTypeSlider: {
				".slider-captcha",
				".slide-verify",
				"[class*='slide']*[class*='captcha']",
			},
			CaptchaTypeImage: {
				".captcha-image",
				"img.captcha",
				"[class*='captcha'] img",
			},
		},
	}
}

func (cd *CaptchaDetector) Detect(ctx context.Context) (CaptchaType, bool) {
	for capType, selectors := range cd.selectors {
		for _, sel := range selectors {
			var exists bool
			err := chromedp.Run(ctx,
				chromedp.Evaluate(fmt.Sprintf(
					"document.querySelector(%q) !== null", sel,
				), &exists),
			)
			if err == nil && exists {
				return capType, true
			}
		}
	}
	return CaptchaTypeUnknown, false
}

func (cd *CaptchaDetector) TakeScreenshot(ctx context.Context) ([]byte, error) {
	var buf []byte
	err := chromedp.Run(ctx,
		chromedp.FullScreenshot(&buf, 90),
	)
	if err != nil {
		return nil, fmt.Errorf("take screenshot: %w", err)
	}
	return buf, nil
}

func NewCaptchaHandler(port int, screenshotsDir string) *CaptchaHandler {
	return &CaptchaHandler{
		port:           port,
		screenshotsDir: screenshotsDir,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
		connections: make(map[string]*websocket.Conn),
		pendingReqs: make(map[string]chan *CaptchaResponse),
	}
}

func (ch *CaptchaHandler) Start(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", ch.handleWebSocket)

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", ch.port),
		Handler: mux,
	}

	go func() {
		log.Info().Int("port", ch.port).Msg("captcha websocket server started")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error().Err(err).Msg("captcha websocket server error")
		}
	}()

	go func() {
		<-ctx.Done()
		log.Info().Msg("captcha websocket server shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(shutdownCtx)
	}()

	return nil
}

func (ch *CaptchaHandler) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := ch.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("websocket upgrade failed")
		return
	}

	connID := fmt.Sprintf("conn-%d", time.Now().UnixNano())
	ch.mu.Lock()
	ch.connections[connID] = conn
	ch.mu.Unlock()

	defer func() {
		ch.mu.Lock()
		delete(ch.connections, connID)
		ch.mu.Unlock()
		conn.Close()
		log.Debug().Str("conn_id", connID).Msg("websocket connection closed")
	}()

	log.Info().Str("conn_id", connID).Str("remote", r.RemoteAddr).Msg("websocket client connected")

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Debug().Err(err).Str("conn_id", connID).Msg("read message failed")
			break
		}

		var resp CaptchaResponse
		if err := json.Unmarshal(msg, &resp); err != nil {
			log.Warn().Err(err).Msg("invalid captcha response")
			continue
		}

		ch.mu.Lock()
		respChan, ok := ch.pendingReqs[resp.ID]
		if ok {
			delete(ch.pendingReqs, resp.ID)
			respChan <- &resp
			close(respChan)
		}
		ch.mu.Unlock()
	}
}

func (ch *CaptchaHandler) SetTUISolver(solver func(site string, capType CaptchaType, screenshot []byte, pageURL string) (string, error)) {
	ch.mu.Lock()
	defer ch.mu.Unlock()
	ch.tuiSolver = solver
}

func (ch *CaptchaHandler) RequestSolve(site string, capType CaptchaType, screenshot []byte, pageURL string) (*CaptchaResponse, error) {
	ch.mu.Lock()
	solver := ch.tuiSolver
	ch.mu.Unlock()

	if solver != nil {
		log.Info().Str("site", site).Str("type", string(capType)).Msg("trying TUI captcha solver")
		solution, err := solver(site, capType, screenshot, pageURL)
		if err == nil && solution != "" {
			log.Info().Str("site", site).Str("solution", solution).Msg("TUI captcha solved successfully")
			return &CaptchaResponse{
				ID:       fmt.Sprintf("tui-%d", time.Now().UnixNano()),
				Solution: solution,
				Solved:   true,
				SolvedAt: time.Now(),
				Operator: "TUI",
			}, nil
		}
		if err != nil {
			log.Warn().Err(err).Str("site", site).Msg("TUI captcha solver failed, falling back to WebSocket")
		}
	}

	reqID := fmt.Sprintf("cap-%d", time.Now().UnixNano())
	respChan := make(chan *CaptchaResponse, 1)

	ch.mu.Lock()
	ch.pendingReqs[reqID] = respChan
	ch.mu.Unlock()

	defer func() {
		ch.mu.Lock()
		if _, ok := ch.pendingReqs[reqID]; ok {
			delete(ch.pendingReqs, reqID)
			close(respChan)
		}
		ch.mu.Unlock()
	}()

	screenshotB64 := base64.StdEncoding.EncodeToString(screenshot)

	req := CaptchaRequest{
		ID:         reqID,
		Site:       site,
		Type:       capType,
		Screenshot: screenshotB64,
		PageURL:    pageURL,
		CreatedAt:  time.Now(),
	}

	reqJSON, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	ch.mu.Lock()
	if len(ch.connections) == 0 {
		ch.mu.Unlock()
		log.Warn().Str("site", site).Msg("no websocket clients connected for captcha")
	}
	for _, conn := range ch.connections {
		err := conn.WriteMessage(websocket.TextMessage, reqJSON)
		if err != nil {
			log.Warn().Err(err).Msg("write captcha request failed")
		}
	}
	ch.mu.Unlock()

	log.Info().Str("id", reqID).Str("site", site).Str("type", string(capType)).Msg("captcha request sent via WebSocket")

	select {
	case resp := <-respChan:
		log.Info().Str("id", reqID).Bool("solved", resp.Solved).Msg("captcha response received")
		return resp, nil
	case <-time.After(5 * time.Minute):
		return nil, fmt.Errorf("captcha solve timeout")
	}
}

func (ch *CaptchaHandler) WaitForOperator(ctx context.Context) error {
	timeout := time.After(5 * time.Minute)
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout:
			return fmt.Errorf("timeout waiting for operator")
		case <-ticker.C:
			ch.mu.Lock()
			count := len(ch.connections)
			ch.mu.Unlock()
			if count > 0 {
				return nil
			}
		}
	}
}

func (ch *CaptchaHandler) ConnectedCount() int {
	ch.mu.Lock()
	defer ch.mu.Unlock()
	return len(ch.connections)
}
