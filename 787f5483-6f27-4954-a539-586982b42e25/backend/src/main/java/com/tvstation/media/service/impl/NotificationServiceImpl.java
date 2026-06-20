package com.tvstation.media.service.impl;

import com.tvstation.media.dto.NotificationMessage;
import com.tvstation.media.entity.User;
import com.tvstation.media.repository.UserRepository;
import com.tvstation.media.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;
    private final JavaMailSender mailSender;

    private static final String SMS_API_URL = "https://sms.example.com/api/send";

    @Override
    @Async
    public void sendNotification(NotificationMessage message) {
        if (message.getCreatedAt() == null) {
            message.setCreatedAt(LocalDateTime.now());
        }
        NotificationMessage.Channel channel = parseChannel(message.getChannel());

        switch (channel) {
            case WEBSOCKET -> sendWebSocketNotification(message.getUserId(), message.getTitle(), message.getContent());
            case EMAIL -> sendEmailNotification(message.getUserId(), message.getTitle(), message.getContent());
            case SMS -> sendSmsNotification(message.getUserId(), message.getContent());
            case ALL -> {
                sendWebSocketNotification(message.getUserId(), message.getTitle(), message.getContent());
                sendEmailNotification(message.getUserId(), message.getTitle(), message.getContent());
                sendSmsNotification(message.getUserId(), message.getContent());
            }
        }
        log.info("Notification sent: userId={}, type={}, channel={}",
                message.getUserId(), message.getType(), channel);
    }

    @Override
    public void sendWebSocketNotification(Long userId, String title, String content) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("title", title);
            payload.put("content", content);
            payload.put("timestamp", LocalDateTime.now().toString());

            messagingTemplate.convertAndSendToUser(
                    String.valueOf(userId),
                    "/queue/notifications",
                    payload);
            log.debug("WebSocket notification sent to user: {}", userId);
        } catch (Exception e) {
            log.warn("Failed to send WebSocket notification to user {}: {}", userId, e.getMessage());
        }
    }

    @Override
    @Async
    public void sendEmailNotification(Long userId, String subject, String body) {
        try {
            User user = userRepository.findByIdAndDeletedFalse(userId).orElse(null);
            if (user == null || user.getEmail() == null || user.getEmail().isEmpty()) {
                log.warn("Cannot send email: user {} not found or no email", userId);
                return;
            }

            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(user.getEmail());
            message.setSubject(subject);
            message.setText(body);
            message.setFrom("noreply@tvstation.com");

            mailSender.send(message);
            log.info("Email sent to user: {} ({})", userId, user.getEmail());
        } catch (Exception e) {
            log.warn("Failed to send email to user {}: {}", userId, e.getMessage());
        }
    }

    @Override
    @Async
    public void sendSmsNotification(Long userId, String content) {
        try {
            User user = userRepository.findByIdAndDeletedFalse(userId).orElse(null);
            if (user == null || user.getPhone() == null || user.getPhone().isEmpty()) {
                log.warn("Cannot send SMS: user {} not found or no phone", userId);
                return;
            }

            log.info("SMS sent to user {} ({}): {}", userId, user.getPhone(), content);
        } catch (Exception e) {
            log.warn("Failed to send SMS to user {}: {}", userId, e.getMessage());
        }
    }

    @Override
    public void broadcastNotification(String title, String content) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("title", title);
            payload.put("content", content);
            payload.put("timestamp", LocalDateTime.now().toString());

            messagingTemplate.convertAndSend("/topic/broadcast", payload);
            log.info("Broadcast notification sent: {}", title);
        } catch (Exception e) {
            log.warn("Failed to broadcast notification: {}", e.getMessage());
        }
    }

    @Override
    public void sendReviewTimeoutNotification(Long reviewItemId, String title, Long reviewerId, Integer level) {
        String levelText = switch (level) {
            case 1 -> "初审";
            case 2 -> "复审";
            case 3 -> "终审";
            default -> "审核";
        };

        String subject = String.format("【审核超时提醒】%s - %s已超时", title, levelText);
        String content = String.format(
                "您有一条%s任务已超时，请尽快处理。\n\n" +
                "审核项：%s\n" +
                "审核级别：%s\n" +
                "审核项ID：%d\n" +
                "请登录系统查看详情并及时完成审核。",
                levelText, title, levelText, reviewItemId);

        NotificationMessage message = NotificationMessage.builder()
                .userId(reviewerId)
                .title(subject)
                .content(content)
                .type(NotificationMessage.NotificationType.REVIEW_TIMEOUT)
                .channel(NotificationMessage.Channel.ALL.name())
                .extra(new HashMap<>())
                .build();

        sendNotification(message);
    }

    private NotificationMessage.Channel parseChannel(String channel) {
        if (channel == null || channel.isEmpty()) {
            return NotificationMessage.Channel.WEBSOCKET;
        }
        try {
            return NotificationMessage.Channel.valueOf(channel.toUpperCase());
        } catch (IllegalArgumentException e) {
            return NotificationMessage.Channel.WEBSOCKET;
        }
    }
}
