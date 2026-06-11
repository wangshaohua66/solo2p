package com.scriptkill.service;

import com.scriptkill.dto.script.ClueResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ClueSseService {

    private static final Logger log = LoggerFactory.getLogger(ClueSseService.class);
    private static final long TIMEOUT_MS = 30 * 60 * 1000L;

    private final Map<Long, SseEmitter> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long sessionId) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        emitters.put(sessionId, emitter);
        emitter.onCompletion(() -> emitters.remove(sessionId));
        emitter.onTimeout(() -> emitters.remove(sessionId));
        emitter.onError(e -> {
            log.warn("SSE error session {}: {}", sessionId, e.getMessage());
            emitters.remove(sessionId);
        });
        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data("{\"sessionId\":" + sessionId + ",\"message\":\"connected\"}"));
        } catch (IOException e) {
            log.warn("Send connected event failed: {}", e.getMessage());
        }
        return emitter;
    }

    public void publishClue(Long sessionId, ClueResponse clue) {
        SseEmitter emitter = emitters.get(sessionId);
        if (emitter == null) {
            return;
        }
        try {
            emitter.send(SseEmitter.event()
                    .name("clue")
                    .data(clue));
        } catch (IOException e) {
            log.warn("Publish clue to session {} failed: {}", sessionId, e.getMessage());
            emitters.remove(sessionId);
        }
    }
}
