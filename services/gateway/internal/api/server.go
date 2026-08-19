package api

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync/atomic"
	"time"
)

const (
	maxTimerBody     = 64 << 10
	maxAnalyticsBody = 2 << 20
)

type Config struct {
	AnalyticsURL string
	TimerURL     string
	Token        string
	Timeout      time.Duration
	Logger       *slog.Logger
}

type Server struct {
	analyticsURL string
	timerURL     string
	token        string
	client       *http.Client
	logger       *slog.Logger
	requestID    atomic.Uint64
}

type serviceHealth struct {
	OK      bool   `json:"ok"`
	Service string `json:"service"`
	Version string `json:"version,omitempty"`
}

type healthResponse struct {
	OK       bool                     `json:"ok"`
	Service  string                   `json:"service"`
	Version  string                   `json:"version"`
	Services map[string]serviceHealth `json:"services"`
	Time     string                   `json:"time"`
}

func New(config Config) (*Server, error) {
	if strings.TrimSpace(config.AnalyticsURL) == "" || strings.TrimSpace(config.TimerURL) == "" {
		return nil, errors.New("analytics and timer service URLs are required")
	}
	if len(config.Token) < 12 {
		return nil, errors.New("internal token must contain at least 12 characters")
	}
	if config.Timeout <= 0 {
		config.Timeout = 5 * time.Second
	}
	if config.Logger == nil {
		config.Logger = slog.Default()
	}
	return &Server{
		analyticsURL: strings.TrimRight(config.AnalyticsURL, "/"),
		timerURL:     strings.TrimRight(config.TimerURL, "/"),
		token:        config.Token,
		client:       &http.Client{Timeout: config.Timeout},
		logger:       config.Logger,
	}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /ready", s.ready)
	mux.Handle("POST /v1/analytics/summary", s.authorize(http.HandlerFunc(s.analytics)))
	mux.Handle("POST /v1/timer/plan", s.authorize(http.HandlerFunc(s.timerPlan)))
	return s.recover(s.observe(s.securityHeaders(mux)))
}

func (s *Server) authorize(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		provided := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		if len(provided) != len(s.token) || subtle.ConstantTimeCompare([]byte(provided), []byte(s.token)) != 1 {
			writeError(w, http.StatusUnauthorized, "AUTH_REQUIRED", "service authentication failed")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	type result struct {
		name   string
		health serviceHealth
	}
	results := make(chan result, 2)
	for name, baseURL := range map[string]string{"analytics": s.analyticsURL, "timer": s.timerURL} {
		go func(name, baseURL string) {
			health := serviceHealth{OK: false, Service: name}
			request, err := http.NewRequestWithContext(r.Context(), http.MethodGet, baseURL+"/health", nil)
			if err == nil {
				response, callErr := s.client.Do(request)
				if callErr == nil {
					defer response.Body.Close()
					if response.StatusCode == http.StatusOK {
						_ = json.NewDecoder(io.LimitReader(response.Body, 32<<10)).Decode(&health)
					}
				}
			}
			results <- result{name: name, health: health}
		}(name, baseURL)
	}
	services := make(map[string]serviceHealth, 2)
	ok := true
	for range 2 {
		item := <-results
		services[item.name] = item.health
		ok = ok && item.health.OK
	}
	status := http.StatusOK
	if !ok {
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, healthResponse{OK: ok, Service: "nova-gateway", Version: "1.0.0", Services: services, Time: time.Now().UTC().Format(time.RFC3339)})
}

func (s *Server) ready(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "service": "nova-gateway"})
}

func (s *Server) analytics(w http.ResponseWriter, r *http.Request) {
	s.proxyJSON(w, r, s.analyticsURL+"/v1/analytics/summary", maxAnalyticsBody)
}

func (s *Server) timerPlan(w http.ResponseWriter, r *http.Request) {
	s.proxyJSON(w, r, s.timerURL+"/v1/timer/plan", maxTimerBody)
}

func (s *Server) proxyJSON(w http.ResponseWriter, r *http.Request, target string, limit int64) {
	body, err := readBody(r, limit)
	if err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", err.Error())
		return
	}
	if !json.Valid(body) {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "request body must be valid JSON")
		return
	}
	request, err := http.NewRequestWithContext(r.Context(), http.MethodPost, target, bytes.NewReader(body))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "REQUEST_FAILED", "unable to create upstream request")
		return
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+s.token)
	request.Header.Set("X-Request-ID", r.Header.Get("X-Request-ID"))
	response, err := s.client.Do(request)
	if err != nil {
		writeError(w, http.StatusBadGateway, "SERVICE_UNAVAILABLE", "NOVA engine is temporarily unavailable")
		return
	}
	defer response.Body.Close()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(response.StatusCode)
	_, _ = io.Copy(w, io.LimitReader(response.Body, 4<<20))
}

func readBody(r *http.Request, limit int64) ([]byte, error) {
	if r.ContentLength > limit {
		return nil, fmt.Errorf("request exceeds %d bytes", limit)
	}
	reader := http.MaxBytesReader(nil, r.Body, limit)
	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("request exceeds %d bytes", limit)
	}
	return body, nil
}

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}

func (s *Server) observe(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		id := fmt.Sprintf("nova-%d", s.requestID.Add(1))
		w.Header().Set("X-Request-ID", id)
		r.Header.Set("X-Request-ID", id)
		next.ServeHTTP(w, r)
		s.logger.Info("request", "id", id, "method", r.Method, "path", r.URL.Path, "duration_ms", time.Since(started).Milliseconds())
	})
}

func (s *Server) recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				s.logger.Error("panic recovered", "error", recovered)
				writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "unexpected server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"ok": false, "error": map[string]string{"code": code, "message": message}})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func Shutdown(server *http.Server, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return server.Shutdown(ctx)
}
