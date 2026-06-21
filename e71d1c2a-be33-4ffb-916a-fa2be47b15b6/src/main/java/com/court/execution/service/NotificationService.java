package com.court.execution.service;

import com.court.execution.entity.Notification;
import com.court.execution.entity.NotificationType;
import com.court.execution.entity.User;
import com.court.execution.repository.NotificationRepository;
import com.court.execution.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class NotificationService {

    private static final Logger logger = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository notificationRepository,
                               UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public Notification sendNotification(Long receiverId, NotificationType type,
                                           String title, String content, String relatedUrl) {
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new RuntimeException("接收人不存在"));

        Notification notification = new Notification();
        notification.setReceiver(receiver);
        notification.setType(type);
        notification.setTitle(title);
        notification.setContent(content);
        notification.setRelatedUrl(relatedUrl);
        notification.setRead(false);

        Notification saved = notificationRepository.save(notification);

        logger.info("通知已发送: 接收人={}, 类型={}, 标题={}", receiver.getRealName(), type, title);

        return saved;
    }

    @Transactional
    public void sendNotificationToUser(User receiver, NotificationType type,
                                        String title, String content, String relatedUrl) {
        Notification notification = new Notification();
        notification.setReceiver(receiver);
        notification.setType(type);
        notification.setTitle(title);
        notification.setContent(content);
        notification.setRelatedUrl(relatedUrl);
        notification.setRead(false);

        notificationRepository.save(notification);

        logger.info("通知已发送: 接收人={}, 类型={}, 标题={}", receiver.getRealName(), type, title);
    }

    @Transactional
    public void sendSeizureWarning(User judge, Long seizureId, Long propertyId,
                                    String propertyName, LocalDateTime expireDate) {
        String title = "查封到期预警";
        String content = String.format("您负责的财产【%s】将于%s到期，请及时办理续封手续。",
                propertyName, expireDate.toLocalDate().toString());
        String url = "/properties/seizure/" + seizureId;

        sendNotificationToUser(judge, NotificationType.SEIZURE_WARNING, title, content, url);
    }

    @Transactional
    public void sendCoordinationReminder(User judge, Long letterId, String letterNumber,
                                          String unitName, LocalDateTime sendTime) {
        String title = "协执函催办提醒";
        String content = String.format("协执函【%s】发送至【%s】已超时未反馈，请及时跟进。发送时间：%s",
                letterNumber, unitName, sendTime.toLocalDate().toString());
        String url = "/coordination/letters/" + letterId;

        sendNotificationToUser(judge, NotificationType.COORDINATION_REMINDER, title, content, url);
    }

    @Transactional
    public void sendApprovalTask(User approver, Long taskId, String taskType,
                                  String taskTitle, User applicant) {
        String title = "待审批任务";
        String content = String.format("【%s】提交了%s待您审批：%s",
                applicant.getRealName(), taskType, taskTitle);
        String url = "/approvals/" + taskId;

        sendNotificationToUser(approver, NotificationType.APPROVAL_TASK, title, content, url);
    }

    @Transactional
    public void sendApprovalResult(User applicant, String taskType,
                                    String taskTitle, boolean approved, String comment) {
        String title = approved ? "审批通过" : "审批驳回";
        String content = String.format("您提交的%s【%s】已%s。%s",
                taskType, taskTitle, approved ? "审批通过" : "被驳回",
                comment != null ? "审批意见：" + comment : "");

        sendNotificationToUser(applicant, NotificationType.APPROVAL_RESULT, title, content, null);
    }

    public List<Notification> getNotificationsByUser(Long userId) {
        return notificationRepository.findByReceiverIdOrderByCreateTimeDesc(userId);
    }

    public List<Notification> getNotificationsByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        return notificationRepository.findByReceiverIdOrderByCreateTimeDesc(user.getId());
    }

    public List<Notification> getUnreadNotificationsByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        return notificationRepository.findByReceiverIdAndReadFalseOrderByCreateTimeDesc(user.getId());
    }

    public long countUnreadByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        return notificationRepository.countByReceiverIdAndReadFalse(user.getId());
    }

    public Page<Notification> getNotificationsByUser(Long userId, Pageable pageable) {
        return notificationRepository.findByReceiverId(userId, pageable);
    }

    public long getUnreadCount(Long userId) {
        return notificationRepository.countByReceiverIdAndReadFalse(userId);
    }

    @Transactional
    public void markAsRead(Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("通知不存在"));
        notification.setRead(true);
        notification.setReadTime(LocalDateTime.now());
        notificationRepository.save(notification);
    }

    @Transactional
    public void markAsRead(Long notificationId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("通知不存在"));
        if (!notification.getReceiver().getId().equals(user.getId())) {
            throw new RuntimeException("无权操作该通知");
        }
        notification.setRead(true);
        notification.setReadTime(LocalDateTime.now());
        notificationRepository.save(notification);
    }

    @Transactional
    public void markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository.findByReceiverIdAndReadFalse(userId);
        for (Notification notification : unread) {
            notification.setRead(true);
            notification.setReadTime(LocalDateTime.now());
            notificationRepository.save(notification);
        }
    }

    @Transactional
    public int markAllAsRead(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        List<Notification> unread = notificationRepository.findByReceiverIdAndReadFalse(user.getId());
        for (Notification notification : unread) {
            notification.setRead(true);
            notification.setReadTime(LocalDateTime.now());
            notificationRepository.save(notification);
        }
        return unread.size();
    }
}
