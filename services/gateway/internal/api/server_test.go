package api

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAuthorizedProxy(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer 123456789012" {
			t.Fatalf("gateway did not authenticate upstream")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"ok":true,"data":{"score":88}}`)
	}))
	defer upstream.Close()

	server, err := New(Config{AnalyticsURL: upstream.URL, TimerURL: upstream.URL, Token: "123456789012", Timeout: time.Second, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/v1/analytics/summary", strings.NewReader(`{"sessions":[]}`))
	request.Header.Set("Authorization", "Bearer 123456789012")
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"score":88`) {
		t.Fatalf("unexpected response: %d %s", response.Code, response.Body.String())
	}
}

func TestRejectsMissingToken(t *testing.T) {
	server, _ := New(Config{AnalyticsURL: "http://analytics", TimerURL: "http://timer", Token: "123456789012", Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	request := httptest.NewRequest(http.MethodPost, "/v1/timer/plan", strings.NewReader(`{}`))
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", response.Code)
	}
}

func TestRejectsInvalidJSON(t *testing.T) {
	server, _ := New(Config{AnalyticsURL: "http://analytics", TimerURL: "http://timer", Token: "123456789012", Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	request := httptest.NewRequest(http.MethodPost, "/v1/timer/plan", strings.NewReader(`not-json`))
	request.Header.Set("Authorization", "Bearer 123456789012")
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", response.Code)
	}
}
