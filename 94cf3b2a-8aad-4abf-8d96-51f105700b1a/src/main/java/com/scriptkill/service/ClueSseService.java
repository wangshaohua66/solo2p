package com.scriptkill.service;

import com.scriptkill.dto.script.ClueResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Service
public class ClueSseService {

    private static final Logger log = LoggerFactory.getLogger(ClueSseService.class);
    private static final long TIMEOUT_MS = 30 * 60 * 1000L;

    private final Map<Long, Set<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long sessionId) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        emitters.computeIfAbsent(sessionId, k -> new CopyOnWriteArraySet<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(sessionId, emitter));
        emitter.onTimeout(() -> removeEmitter(sessionId, emitter));
        emitter.onError(e -> {
            log.warn("SSE error session {}: {}", sessionId, e.getMessage());
            removeEmitter(sessionId, emitter);
        });

        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data("{\"sessionId\":" + sessionId + ",\"message\":\"connected\"}"));
        } catch (IOException e) {
            log.warn("Send connected event failed: {}", e.getMessage());
            removeEmitter(sessionId, emitter);
        }
        return emitter;
    }

    public void publishClue(Long sessionId, ClueResponse clue) {
        Set<SseEmitter> sessionEmitters = emitters.get(sessionId);
        if (sessionEmitters == null || sessionEmitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : sessionEmitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("clue")
                        .data(clue));
            } catch (IOException e) {
                log.warn("Publish clue to session {} emitter failed, removing: {}",
                        sessionId, e.getMessage());
                removeEmitter(sessionId, emitter);
            }
        }
    }

    private void removeEmitter(Long sessionId, SseEmitter emitter) {
        Set<SseEmitter> sessionEmitters = emitters.get(sessionId);
        if (sessionEmitters != null) {
            sessionEmitters.remove(emitter);
            if (sessionEmitters.isEmpty()) {
                emitters.remove(sessionId);
            }
        }
    }
}
