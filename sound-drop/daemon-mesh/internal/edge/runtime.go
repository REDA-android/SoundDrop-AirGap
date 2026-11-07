package edge

import (
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// EdgeRequest mimics a Vercel Edge Request executed in offline isolation
type EdgeRequest struct {
	Route     string          `json:"route"`
	Method    string          `json:"method"`
	Payload   json.RawMessage `json:"payload"`
	Headers   map[string]string `json:"headers"`
	Timestamp int64           `json:"timestamp"`
}

// EdgeResponse mimics a Vercel Edge Response returned via local IPC
type EdgeResponse struct {
	Status    int             `json:"status"`
	Body      json.RawMessage `json:"body"`
	LatencyMs int64           `json:"latency_ms"`
}

// LocalEdgeRuntime provides zero-cloud offline emulation
type LocalEdgeRuntime struct {
	handlers map[string]func(req EdgeRequest) EdgeResponse
}

func NewLocalEdgeRuntime() *LocalEdgeRuntime {
	rt := &LocalEdgeRuntime{
		handlers: make(map[string]func(req EdgeRequest) EdgeResponse),
	}
	rt.registerDefaultRoutes()
	return rt
}

func (rt *LocalEdgeRuntime) registerDefaultRoutes() {
	// Route: /api/vault/verify-drop
	rt.handlers["/api/vault/verify-drop"] = func(req EdgeRequest) EdgeResponse {
		body, _ := json.Marshal(map[string]any{
			"verified": true,
			"airgap":   "enforced",
			"hash":     "BLURHASH_P0_COMPACT_OK",
		})
		return EdgeResponse{Status: 200, Body: body}
	}

	// Route: /api/telemetry/report-snr
	rt.handlers["/api/telemetry/report-snr"] = func(req EdgeRequest) EdgeResponse {
		body, _ := json.Marshal(map[string]string{
			"status": "logged_to_local_vault",
		})
		return EdgeResponse{Status: 200, Body: body}
	}
}

func (rt *LocalEdgeRuntime) Dispatch(req EdgeRequest) EdgeResponse {
	start := time.Now()
	handler, exists := rt.handlers[req.Route]
	if !exists {
		errBody, _ := json.Marshal(map[string]string{"error": "route not found in offline edge"})
		return EdgeResponse{Status: 404, Body: errBody, LatencyMs: time.Since(start).Milliseconds()}
	}

	res := handler(req)
	res.LatencyMs = time.Since(start).Milliseconds()
	log.Printf("[Offline Edge Runtime] Executed %s [%d] in %d ms (Airgap Local)", req.Route, res.Status, res.LatencyMs)
	return res
}
