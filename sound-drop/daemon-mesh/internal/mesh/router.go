package mesh

import (
	"fmt"
	"log"
	"sync"
	"time"
)

// MeshPacketHeader represents routing metadata within acoustic frames
type MeshPacketHeader struct {
	SourceNode      string `json:"source_node"`
	DestinationNode string `json:"dest_node"`
	HopCount        int    `json:"hop_count"`
	TTL             int    `json:"ttl"`
	SessionID       uint8  `json:"session_id"`
	PacketIndex     int    `json:"packet_index"`
}

type MeshRouter struct {
	localNodeID string
	seenPackets map[string]time.Time
	mu          sync.Mutex
	relayQueue  chan MeshPacketHeader
}

func NewMeshRouter(nodeID string) *MeshRouter {
	return &MeshRouter{
		localNodeID: nodeID,
		seenPackets: make(map[string]time.Time),
		relayQueue:  make(chan MeshPacketHeader, 64),
	}
}

// IngestPacket processes an acoustic frame and determines routing action
func (r *MeshRouter) IngestPacket(hdr MeshPacketHeader) (isForMe bool, shouldRelay bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	packetKey := fmt.Sprintf("%s:%d:%d", hdr.SourceNode, hdr.SessionID, hdr.PacketIndex)

	// Deduplication: drop already seen packets
	if _, exists := r.seenPackets[packetKey]; exists {
		return false, false
	}
	r.seenPackets[packetKey] = time.Now()

	// Is this node the final destination?
	if hdr.DestinationNode == r.localNodeID || hdr.DestinationNode == "BROADCAST" {
		log.Printf("[Mesh Router] Packet destined for local node %s (Hops: %d)", r.localNodeID, hdr.HopCount)
		return true, false
	}

	// Multi-Hop Relay check
	if hdr.TTL > 1 {
		hdr.TTL--
		hdr.HopCount++
		log.Printf("[Mesh Router] Relaying packet for %s via acoustic repeat (New TTL: %d, Hop: %d)",
			hdr.DestinationNode, hdr.TTL, hdr.HopCount)

		select {
		case r.relayQueue <- hdr:
			return false, true
		default:
			log.Println("[Mesh Router] Relay queue full, dropped frame")
			return false, false
		}
	}

	log.Printf("[Mesh Router] Packet TTL expired for %s", hdr.DestinationNode)
	return false, false
}

func (r *MeshRouter) RelayQueue() <-chan MeshPacketHeader {
	return r.relayQueue
}
