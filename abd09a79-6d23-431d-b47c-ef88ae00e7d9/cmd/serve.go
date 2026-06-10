package cmd

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	webpkg "bankrupt-monitor/internal/web"

	"go.uber.org/zap"
)

func RunServe(configPath string, port int, watch bool) error {
	cfg, log, db, err := bootstrap(configPath, watch)
	if err != nil {
		return err
	}
	defer log.Sync()
	defer db.Close()

	if port <= 0 {
		port = cfg.Web.Port
	}
	addr := fmt.Sprintf("%s:%d", cfg.Web.Host, port)

	handler := webpkg.NewHandler(db, log, cfg)

	srv := &http.Server{
		Addr:         addr,
		Handler:      handler.Routes(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("web server starting", zap.String("addr", "http://"+addr))
		fmt.Fprintf(os.Stderr, "Web 界面已启动: http://%s\n", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		return err
	case <-sigCh:
		fmt.Fprintln(os.Stderr, "\n收到退出信号，正在停止服务...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(ctx)
	}
}
