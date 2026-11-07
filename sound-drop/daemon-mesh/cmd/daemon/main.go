package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"sound-drop-mesh/internal/edge"
	"sound-drop-mesh/internal/mesh"
	"sound-drop-mesh/ipc"
)

func main() {
	log.Println("[SoundDrop Airgap Daemon] Initializing v2.0.0 (Zero-RF, Multi-Hop Mesh)...")

	nodeID := "NODE_LOCAL_OBSIDIAN"
	router := mesh.NewMeshRouter(nodeID)
	edgeRuntime := edge.NewLocalEdgeRuntime()

	pipeServer, err := ipc.NewLocalPipeServer(9455)
	if err != nil {
		log.Fatalf("[Airgap Daemon] Pipe initialization failed: %v", err)
	}
	pipeServer.Start()
	log.Println("[Airgap Daemon] Local IPC Named Pipe ready on 127.0.0.1:9455")

	// Worker Goroutine 1: Process multi-hop mesh repeat queue
	go func() {
		for relayHdr := range router.RelayQueue() {
			log.Printf("[Airgap Daemon] Acoustic Repeat Transmit: Session %d, Frame %d",
				relayHdr.SessionID, relayHdr.PacketIndex)
			_ = pipeServer.Broadcast("EVENT_ACOUSTIC_REPEAT", relayHdr)
		}
	}()

	// Worker Goroutine 2: Inbound IPC Command and Event Dispatcher
	go func() {
		for msg := range pipeServer.Inbound() {
			switch msg.Event {
			case "EDGE_REQUEST":
				var req edge.EdgeRequest
				if err := json.Unmarshal(msg.Payload, &req); == nil {
					res := edgeRuntime.Dispatch(req)
					_ = pipeServer.Broadcast("EDGE_RESPONSE", res)
				}
			case "ACOUSTIC_FRAME_INGEST":
				var hdr mesh.MeshPacketHeader
				if err := json.Unmarshal(msg.Payload, &hdr); == nil {
					isForMe, shouldRelay := router.IngestPacket(hdr)
					if isForMe {
						_ = pipeServer.Broadcast("PACKET_ACCEPTED", hdr)
					}
					if shouldRelay {
						_ = pipeServer.Broadcast("PACKET_QUEUED_FOR_RELAY", hdr)
					}
				}
			}
		}
	}()

	// Heartbeat Telemetry
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			_ = pipeServer.Broadcast("AIRGAP_HEARTBEAT", map[string]any{
				"node_id":   nodeID,
				"timestamp": time.Now().UnixMilli(),
				"airgap":    true,
			})
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig

	log.Println("[Airgap Daemon] Shutting down...")
	_ = pipeServer.Close()
	fmt.Println("[Airgap Daemon] Terminated.")
}
