package main

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Mishadoloh/Nova/services/gateway/internal/api"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		healthcheck()
		return
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	timeout, err := time.ParseDuration(env("NOVA_REQUEST_TIMEOUT", "5s"))
	if err != nil {
		logger.Error("invalid request timeout", "error", err)
		os.Exit(1)
	}
	service, err := api.New(api.Config{
		AnalyticsURL: env("NOVA_ANALYTICS_URL", "http://analytics:8090"),
		TimerURL:     env("NOVA_TIMER_URL", "http://timer-engine:8070"),
		Token:        env("NOVA_INTERNAL_TOKEN", ""),
		Timeout:      timeout,
		Logger:       logger,
	})
	if err != nil {
		logger.Error("invalid configuration", "error", err)
		os.Exit(1)
	}
	server := &http.Server{
		Addr:              env("NOVA_HTTP_ADDR", ":8080"),
		Handler:           service.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	done := make(chan os.Signal, 1)
	signal.Notify(done, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		logger.Info("gateway started", "address", server.Addr)
		if serveErr := server.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			logger.Error("gateway stopped unexpectedly", "error", serveErr)
			os.Exit(1)
		}
	}()
	<-done
	logger.Info("gateway shutting down")
	if err := api.Shutdown(server, 8*time.Second); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func healthcheck() {
	response, err := (&http.Client{Timeout: 2 * time.Second}).Get("http://127.0.0.1:8080/ready")
	if err != nil || response.StatusCode != http.StatusOK {
		fmt.Fprintln(os.Stderr, "gateway is not ready")
		os.Exit(1)
	}
	_ = response.Body.Close()
}
