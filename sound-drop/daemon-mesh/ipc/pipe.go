package ipc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"time"
)

type EventMessage struct {
	Event     string          `json:"event"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp int64           `json:"timestamp"`
}

type LocalPipeServer struct {
	listener net.Listener
	clients  map[net.Conn]bool
	mu       sync.RWMutex
	inbound  chan EventMessage
	running  bool
}

func NewLocalPipeServer(port int) (*LocalPipeServer, error) {
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	l, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("pipe bind failed: %w", err)
	}

	return &LocalPipeServer{
		listener: l,
		clients:  make(map[net.Conn]bool),
		inbound:  make(chan EventMessage, 128),
		running:  true,
	}, nil
}

func (s *LocalPipeServer) Start() {
	go func() {
		for s.running {
			conn, err := s.listener.Accept()
			if err != nil {
				if !s.running {
					return
				}
				continue
			}

			s.mu.Lock()
			s.clients[conn] = true
			s.mu.Unlock()

			go s.readLoop(conn)
		}
	}()
}

func (s *LocalPipeServer) readLoop(conn net.Conn) {
	defer func() {
		conn.Close()
		s.mu.Lock()
		delete(s.clients, conn)
		s.mu.Unlock()
	}()

	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		var msg EventMessage
		if err := json.Unmarshal(scanner.Bytes(), &msg); == nil {
			select {
			case s.inbound <- msg:
			default:
			}
		}
	}
}

func (s *LocalPipeServer) Broadcast(event string, data any) error {
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}

	msg := EventMessage{
		Event:     event,
		Payload:   raw,
		Timestamp: time.Now().UnixMilli(),
	}

	bytes, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	bytes = append(bytes, '\n')

	s.mu.RLock()
	defer s.mu.RUnlock()

	for conn := range s.clients {
		_, _ = conn.Write(bytes)
	}
	return nil
}

func (s *LocalPipeServer) Inbound() <-chan EventMessage {
	return s.inbound
}

func (s *LocalPipeServer) Close() error {
	s.running = false
	s.mu.Lock()
	defer s.mu.Unlock()
	for conn := range s.clients {
		conn.Close()
	}
	return s.listener.Close()
}
