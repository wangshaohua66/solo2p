package ws

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type MessageType string

const (
	MsgTypePiracyAlert    MessageType = "piracy_alert"
	MsgTypeCrawlProgress  MessageType = "crawl_progress"
	MsgTypeAlert          MessageType = "alert"
	MsgTypePing           MessageType = "ping"
	MsgTypePong           MessageType = "pong"
)

type WebSocketMessage struct {
	Type    MessageType `json:"type"`
	Payload interface{} `json:"payload"`
}

type PiracyAlertPayload struct {
	PiracyID    string  `json:"piracy_id"`
	WorkID      string  `json:"work_id"`
	WorkTitle   string  `json:"work_title"`
	MatchScore  float64 `json:"match_score"`
	SuspectURL  string  `json:"suspect_url"`
	SuspectName string  `json:"suspect_name"`
	Platform    string  `json:"platform"`
}

type AlertPayload struct {
	Level   string `json:"level"`
	Title   string `json:"title"`
	Message string `json:"message"`
}

type CrawlProgressPayload struct {
	TaskID    string  `json:"task_id"`
	Platform  string  `json:"platform"`
	Progress  float64 `json:"progress"`
	Status    string  `json:"status"`
	ErrorMsg  string  `json:"error_msg,omitempty"`
}

type Client struct {
	conn   *websocket.Conn
	send   chan []byte
	userID string
	roles  []string
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client, 16),
		unregister: make(chan *Client, 16),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("[WS] Client connected: %s", client.userID)
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("[WS] Client disconnected: %s", client.userID)
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Broadcast(msgType MessageType, payload interface{}) error {
	msg := WebSocketMessage{
		Type:    msgType,
		Payload: payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	h.broadcast <- data
	return nil
}

func (h *Hub) SendToUser(userID string, msgType MessageType, payload interface{}) error {
	msg := WebSocketMessage{
		Type:    msgType,
		Payload: payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients {
		if client.userID == userID {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
	return nil
}

func (h *Hub) SendToRoles(roles []string, msgType MessageType, payload interface{}) error {
	msg := WebSocketMessage{
		Type:    msgType,
		Payload: payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients {
		for _, cr := range client.roles {
			for _, r := range roles {
				if cr == r {
					select {
					case client.send <- data:
					default:
						close(client.send)
						delete(h.clients, client)
					}
					goto next
				}
			}
		next:
		}
	}
	return nil
}

func (c *Client) ReadPump(hub *Hub) {
	defer func() {
		hub.unregister <- c
		_ = c.conn.Close()
	}()

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS] read error: %v", err)
			}
			break
		}
	}
}

func (c *Client) WritePump() {
	defer func() {
		_ = c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			_ = c.conn.WriteMessage(websocket.TextMessage, message)
		}
	}
}
