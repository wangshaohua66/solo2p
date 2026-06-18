package com.wedding.suite.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wedding.suite.entity.NotificationEntity;
import com.wedding.suite.entity.UserEntity;
import com.wedding.suite.enums.NotificationType;
import com.wedding.suite.repository.NotificationRepository;
import com.wedding.suite.repository.UserRepository;
import com.wedding.suite.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class NotificationServiceImpl implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationServiceImpl.class);

    private final NotificationRepository repo;
    private final UserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final Map<Long, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public NotificationServiceImpl(NotificationRepository repo, UserRepository userRepo, ObjectMapper objectMapper) {
        this.repo = repo;
        this.userRepo = userRepo;
        this.objectMapper = objectMapper;
    }

    public SseEmitter register(Long userId) {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> remove(userId, emitter));
        emitter.onTimeout(() -> {
            remove(userId, emitter);
            emitter.complete();
        });
        emitter.onError(e -> remove(userId, emitter));
        return emitter;
    }

    @Override
    @Transactional
    public void push(Long userId, String title, String content, NotificationType type, String bizType, Long bizId) {
        NotificationEntity n = NotificationEntity.builder()
                .userId(userId).title(title).content(content).type(type)
                .bizType(bizType).bizId(bizId).readFlag(false).build();
        repo.save(n);
        sendSse(userId, n);
    }

    @Override
    @Transactional
    public void broadcast(String title, String content, NotificationType type) {
        List<UserEntity> users = userRepo.findAll();
        for (UserEntity u : users) {
            NotificationEntity n = NotificationEntity.builder()
                    .userId(u.getId()).title(title).content(content).type(type).readFlag(false).build();
            repo.save(n);
            sendSse(u.getId(), n);
        }
    }

    @Override
    public List<NotificationEntity> listMine(Long userId) {
        return repo.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Override
    public long unreadCount(Long userId) {
        return repo.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(n -> !Boolean.TRUE.equals(n.getReadFlag())).count();
    }

    @Override
    @Transactional
    public void markRead(Long id) {
        repo.findById(id).ifPresent(n -> {
            n.setReadFlag(true);
            repo.save(n);
        });
    }

    @Override
    @Transactional
    public void markAllRead(Long userId) {
        repo.findByUserIdOrderByCreatedAtDesc(userId).forEach(n -> {
            n.setReadFlag(true);
            repo.save(n);
        });
    }

    private void sendSse(Long userId, NotificationEntity n) {
        List<SseEmitter> list = emitters.get(userId);
        if (list == null) return;
        String payload;
        try {
            payload = objectMapper.writeValueAsString(n);
        } catch (Exception e) {
            return;
        }
        for (SseEmitter e : list) {
            try {
                e.send(SseEmitter.event().name("notification").data(payload));
            } catch (IOException ex) {
                remove(userId, e);
            }
        }
    }

    private void remove(Long userId, SseEmitter emitter) {
        List<SseEmitter> list = emitters.get(userId);
        if (list != null) {
            list.remove(emitter);
        }
    }
}
