package arq

import (
	"sync"
	"time"
)

type PacketState string

const (
	StatePending     PacketState = "PENDING"
	StateTransmitted PacketState = "TRANSMITTED"
	StateAcked       PacketState = "ACKED"
	StateNacked      PacketState = "NACKED"
)

type ArqSession struct {
	SessionID   uint8
	TotalFrames int
	Statuses    map[int]PacketState
	SentTimes   map[int]time.Time
	RetryCount  map[int]int
	mu          sync.Mutex
}

func NewArqSession(sessionID uint8, totalFrames int) *ArqSession {
	s := &ArqSession{
		SessionID:   sessionID,
		TotalFrames: totalFrames,
		Statuses:    make(map[int]PacketState),
		SentTimes:   make(map[int]time.Time),
		RetryCount:  make(map[int]int),
	}
	for i := 0; i < totalFrames; i++ {
		s.Statuses[i] = StatePending
	}
	return s
}

func (s *ArqSession) MarkTransmitted(index int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Statuses[index] = StateTransmitted
	s.SentTimes[index] = time.Now()
}

func (s *ArqSession) HandleAck(index int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Statuses[index] = StateAcked
}

func (s *ArqSession) HandleNack(index int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Statuses[index] = StateNacked
	s.RetryCount[index]++
	return s.RetryCount[index] <= 4 // Allow up to 4 acoustic retransmissions
}

func (s *ArqSession) IsComplete() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := 0; i < s.TotalFrames; i++ {
		if s.Statuses[i] != StateAcked {
			return false
		}
	}
	return true
}
