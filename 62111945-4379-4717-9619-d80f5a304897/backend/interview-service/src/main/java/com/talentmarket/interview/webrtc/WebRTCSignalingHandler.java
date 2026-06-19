package com.talentmarket.interview.webrtc;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebRTCSignalingHandler extends TextWebSocketHandler {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final Map<String, Map<String, WebSocketSession>> ROOMS = new ConcurrentHashMap<>();
    private static final Map<String, String> USER_ROOM_MAP = new ConcurrentHashMap<>();
    private static final String USER_ID_ATTR = "userId";
    private static final String USER_NAME_ATTR = "userName";
    private static final String USER_ROLE_ATTR = "userRole";

    @PostConstruct
    public void init() {
        log.info("WebRTC信令服务初始化完成");
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String userId = getQueryParam(session, "userId");
        String userName = getQueryParam(session, "userName");
        String userRole = getQueryParam(session, "userRole");

        session.getAttributes().put(USER_ID_ATTR, userId);
        session.getAttributes().put(USER_NAME_ATTR, userName);
        session.getAttributes().put(USER_ROLE_ATTR, userRole);

        log.info("WebSocket连接建立，用户ID: {}, 用户名: {}, 角色: {}", userId, userName, userRole);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JSONObject payload = JSON.parseObject(message.getPayload());
            String type = payload.getString("type");
            String roomId = payload.getString("roomId");
            String userId = (String) session.getAttributes().get(USER_ID_ATTR);
            String userName = (String) session.getAttributes().get(USER_NAME_ATTR);

            log.debug("收到信令消息，类型: {}, 房间: {}, 用户: {}", type, roomId, userId);

            switch (type) {
                case "join":
                    handleJoin(session, roomId, userId, userName);
                    break;
                case "offer":
                case "answer":
                case "candidate":
                    handleSignalingMessage(session, roomId, userId, type, payload);
                    break;
                case "leave":
                    handleLeave(session, roomId, userId);
                    break;
                case "chat":
                    handleChatMessage(session, roomId, userId, userName, payload);
                    break;
                case "status":
                    handleStatusUpdate(session, roomId, userId, payload);
                    break;
                default:
                    log.warn("未知的信令消息类型: {}", type);
            }
        } catch (Exception e) {
            log.error("处理信令消息失败", e);
        }
    }

    private void handleJoin(WebSocketSession session, String roomId, String userId, String userName) {
        ROOMS.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());

        Map<String, WebSocketSession> room = ROOMS.get(roomId);

        for (Map.Entry<String, WebSocketSession> entry : room.entrySet()) {
            if (!entry.getKey().equals(userId)) {
                JSONObject joinMsg = new JSONObject();
                joinMsg.put("type", "user-joined");
                joinMsg.put("userId", userId);
                joinMsg.put("userName", userName);
                sendMessage(entry.getValue(), joinMsg);
            }
        }

        room.put(userId, session);
        USER_ROOM_MAP.put(userId, roomId);

        JSONObject joinedMsg = new JSONObject();
        joinedMsg.put("type", "joined");
        joinedMsg.put("roomId", roomId);
        joinedMsg.put("userId", userId);
        joinedMsg.put("participants", room.size());
        sendMessage(session, joinedMsg);

        log.info("用户加入房间，房间: {}, 用户: {}, 当前人数: {}", roomId, userName, room.size());

        saveRoomToRedis(roomId);
    }

    private void handleSignalingMessage(WebSocketSession session, String roomId,
                                        String senderId, String type, JSONObject payload) {
        String targetId = payload.getString("targetId");
        Map<String, WebSocketSession> room = ROOMS.get(roomId);

        if (room == null) {
            log.warn("房间不存在: {}", roomId);
            return;
        }

        if (targetId != null) {
            WebSocketSession targetSession = room.get(targetId);
            if (targetSession != null && targetSession.isOpen()) {
                JSONObject msg = new JSONObject();
                msg.put("type", type);
                msg.put("from", senderId);
                msg.put("data", payload.get("data"));
                sendMessage(targetSession, msg);
            }
        } else {
            for (Map.Entry<String, WebSocketSession> entry : room.entrySet()) {
                if (!entry.getKey().equals(senderId) && entry.getValue().isOpen()) {
                    JSONObject msg = new JSONObject();
                    msg.put("type", type);
                    msg.put("from", senderId);
                    msg.put("data", payload.get("data"));
                    sendMessage(entry.getValue(), msg);
                }
            }
        }
    }

    private void handleLeave(WebSocketSession session, String roomId, String userId) {
        Map<String, WebSocketSession> room = ROOMS.get(roomId);
        if (room != null) {
            room.remove(userId);
            USER_ROOM_MAP.remove(userId);

            JSONObject leaveMsg = new JSONObject();
            leaveMsg.put("type", "user-left");
            leaveMsg.put("userId", userId);

            for (WebSocketSession s : room.values()) {
                if (s.isOpen()) {
                    sendMessage(s, leaveMsg);
                }
            }

            if (room.isEmpty()) {
                ROOMS.remove(roomId);
                removeRoomFromRedis(roomId);
            }

            log.info("用户离开房间，房间: {}, 用户: {}, 当前人数: {}",
                    roomId, userId, room.size());
        }
    }

    private void handleChatMessage(WebSocketSession session, String roomId,
                                   String userId, String userName, JSONObject payload) {
        String content = payload.getString("content");
        Map<String, WebSocketSession> room = ROOMS.get(roomId);

        if (room == null) return;

        JSONObject chatMsg = new JSONObject();
        chatMsg.put("type", "chat");
        chatMsg.put("from", userId);
        chatMsg.put("fromName", userName);
        chatMsg.put("content", content);
        chatMsg.put("timestamp", System.currentTimeMillis());

        for (WebSocketSession s : room.values()) {
            if (s.isOpen()) {
                sendMessage(s, chatMsg);
            }
        }
    }

    private void handleStatusUpdate(WebSocketSession session, String roomId,
                                    String userId, JSONObject payload) {
        Map<String, WebSocketSession> room = ROOMS.get(roomId);
        if (room == null) return;

        JSONObject statusMsg = new JSONObject();
        statusMsg.put("type", "status");
        statusMsg.put("userId", userId);
        statusMsg.put("audioEnabled", payload.getBoolean("audioEnabled"));
        statusMsg.put("videoEnabled", payload.getBoolean("videoEnabled"));
        statusMsg.put("screenSharing", payload.getBoolean("screenSharing"));

        for (Map.Entry<String, WebSocketSession> entry : room.entrySet()) {
            if (!entry.getKey().equals(userId) && entry.getValue().isOpen()) {
                sendMessage(entry.getValue(), statusMsg);
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String userId = (String) session.getAttributes().get(USER_ID_ATTR);
        String roomId = USER_ROOM_MAP.get(userId);

        if (roomId != null) {
            handleLeave(session, roomId, userId);
        }

        log.info("WebSocket连接关闭，用户ID: {}, 状态: {}", userId, status);
    }

    private void sendMessage(WebSocketSession session, JSONObject message) {
        try {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(message.toJSONString()));
            }
        } catch (Exception e) {
            log.error("发送WebSocket消息失败", e);
        }
    }

    private String getQueryParam(WebSocketSession session, String name) {
        String query = session.getUri().getQuery();
        if (query == null) return null;

        for (String param : query.split("&")) {
            String[] pair = param.split("=");
            if (pair.length == 2 && pair[0].equals(name)) {
                return pair[1];
            }
        }
        return null;
    }

    private void saveRoomToRedis(String roomId) {
        String key = "webrtc:room:" + roomId;
        redisTemplate.opsForValue().set(key, System.currentTimeMillis(), 2, TimeUnit.HOURS);
    }

    private void removeRoomFromRedis(String roomId) {
        redisTemplate.delete("webrtc:room:" + roomId);
    }

    public int getRoomParticipantCount(String roomId) {
        Map<String, WebSocketSession> room = ROOMS.get(roomId);
        return room != null ? room.size() : 0;
    }

    public boolean isRoomActive(String roomId) {
        return ROOMS.containsKey(roomId) && !ROOMS.get(roomId).isEmpty();
    }
}
