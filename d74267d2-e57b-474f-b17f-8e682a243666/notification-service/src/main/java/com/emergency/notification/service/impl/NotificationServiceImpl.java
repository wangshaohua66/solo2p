package com.emergency.notification.service.impl;

import com.emergency.common.dto.LoginUser;
import com.emergency.common.enums.NotificationChannel;
import com.emergency.common.enums.NotificationStatus;
import com.emergency.common.exception.BusinessException;
import com.emergency.common.result.Result;
import com.emergency.common.result.ResultCode;
import com.emergency.common.util.IdGenerator;
import com.emergency.common.util.SecurityUtils;
import com.emergency.notification.channel.NotificationChannel;
import com.emergency.notification.dto.NotificationSendRequest;
import com.emergency.notification.entity.Notification;
import com.emergency.notification.entity.NotificationReceipt;
import com.emergency.notification.entity.NotificationTemplate;
import com.emergency.notification.feign.IncidentFeignClient;
import com.emergency.notification.mapper.NotificationMapper;
import com.emergency.notification.mapper.NotificationReceiptMapper;
import com.emergency.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final NotificationMapper notificationMapper;
    private final NotificationReceiptMapper receiptMapper;
    private final List<NotificationChannel> channels;
    private final IncidentFeignClient incidentFeignClient;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long sendNotification(NotificationSendRequest request) {
        LoginUser currentUser = SecurityUtils.getCurrentUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        Notification notification = new Notification();
        notification.setNotificationNo(IdGenerator.generateNotificationNo());
        notification.setIncidentId(request.getIncidentId());
        notification.setDispatchPlanId(request.getDispatchPlanId());
        notification.setTitle(request.getTitle());
        notification.setContent(request.getContent());
        notification.setSummary(request.getSummary());
        notification.setChannel(request.getChannels().get(0));
        notification.setTargetType(request.getTargetType());
        notification.setTargetIds(request.getTargetIds().stream()
                .map(String::valueOf).collect(Collectors.joining(",")));
        notification.setTargetCount(request.getTargetIds().size());
        notification.setPriority(request.getPriority());
        notification.setRegionCode(request.getRegionCode());
        notification.setIncidentLevel(request.getIncidentLevel());
        notification.setScheduledAt(request.getScheduledAt());
        notification.setExpiredAt(request.getExpiredAt());
        notification.setTemplateCode(request.getTemplateCode());
        notification.setTemplateParams(request.getTemplateParams());
        notification.setCallbackUrl(request.getCallbackUrl());

        if (request.getScheduledAt() != null && request.getScheduledAt().isAfter(LocalDateTime.now())) {
            notification.setStatus(NotificationStatus.PENDING);
        } else {
            notification.setStatus(NotificationStatus.PENDING);
        }

        notificationMapper.insert(notification);

        List<NotificationReceipt> receipts = createReceipts(notification, request.getTargetIds());
        sendToChannels(notification, receipts, request.getChannels());

        log.info("创建通知成功: notificationId={}, title={}, channelCount={}",
                notification.getId(), request.getTitle(), request.getChannels().size());

        if (request.getScheduledAt() == null || request.getScheduledAt().isBefore(LocalDateTime.now())) {
            asyncSendNotification(notification.getId());
        }

        return notification.getId();
    }

    private List<NotificationReceipt> createReceipts(Notification notification, List<Long> targetIds) {
        List<NotificationReceipt> receipts = new ArrayList<>();
        for (Long targetId : targetIds) {
            NotificationReceipt receipt = new NotificationReceipt();
            receipt.setNotificationId(notification.getId());
            receipt.setRecipientId(targetId);
            receipt.setRecipientName("用户" + targetId);
            receipt.setRecipientPhone("13800138000");
            receipt.setStatus(NotificationStatus.PENDING);
            receiptMapper.insert(receipt);
            receipts.add(receipt);
        }
        return receipts;
    }

    private void sendToChannels(Notification notification, List<NotificationReceipt> receipts,
                                List<NotificationChannel> channels) {
        Map<String, NotificationChannel> channelMap = channels.stream()
                .collect(Collectors.toMap(NotificationChannel::getChannelName, c -> c));

        for (NotificationChannel channel : channels) {
            NotificationChannel sender = channelMap.get(channel.name());
            if (sender != null) {
                List<NotificationReceipt> channelReceipts = receipts.stream()
                        .map(r -> {
                            NotificationReceipt nr = new NotificationReceipt();
                            nr.setNotificationId(r.getNotificationId());
                            nr.setRecipientId(r.getRecipientId());
                            nr.setRecipientName(r.getRecipientName());
                            nr.setRecipientPhone(r.getRecipientPhone());
                            nr.setStatus(NotificationStatus.PENDING);
                            return nr;
                        })
                        .collect(Collectors.toList());

                boolean success = sender.send(notification, channelReceipts);
                for (NotificationReceipt r : channelReceipts) {
                    if (success) {
                        receiptMapper.insert(r);
                    }
                }

                int successCount = (int) channelReceipts.stream()
                        .filter(r -> r.getStatus() == NotificationStatus.SENT).count();
                int failCount = channelReceipts.size() - successCount;

                notification.setSuccessCount(successCount);
                notification.setFailCount(failCount);
                if (successCount == channelReceipts.size()) {
                    notification.setStatus(NotificationStatus.SENT);
                } else if (successCount > 0) {
                    notification.setStatus(NotificationStatus.SENT);
                } else {
                    notification.setStatus(NotificationStatus.FAILED);
                    notification.setFailureReason("所有通道发送失败");
                }
                notification.setSentAt(LocalDateTime.now());
                notificationMapper.updateById(notification);
            }
        }
    }

    @Async
    @Transactional(rollbackFor = Exception.class)
    public void asyncSendNotification(Long notificationId) {
        try {
            Notification notification = notificationMapper.selectById(notificationId);
            if (notification == null || notification.getStatus() != NotificationStatus.PENDING) {
                return;
            }
            log.info("异步发送通知: notificationId={}", notificationId);
            notificationMapper.updateStatus(notificationId, NotificationStatus.SENT.getCode(),
                    LocalDateTime.now(), SecurityUtils.getCurrentUserId());
        } catch (Exception e) {
            log.error("异步发送通知失败: notificationId={}", notificationId, e);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long sendIncidentAlert(Long incidentId) {
        Result<?> incidentResult = incidentFeignClient.getIncidentById(incidentId);
        if (!incidentResult.isSuccess() || incidentResult.getData() == null) {
            throw new BusinessException("灾情信息不存在");
        }

        var incidentData = (java.util.Map<String, Object>) incidentResult.getData();
        String title = "【灾情预警】" + incidentData.get("title");
        String content = (String) incidentData.get("description");
        String regionCode = (String) incidentData.get("regionCode");
        Integer level = (Integer) incidentData.get("level");

        NotificationSendRequest request = new NotificationSendRequest();
        request.setTitle(title);
        request.setContent(content);
        request.setSummary(content.substring(0, Math.min(100, content.length())));
        request.setChannels(Arrays.asList(NotificationChannel.SMS, NotificationChannel.APP_PUSH));
        request.setTargetType("REGION");
        request.setTargetIds(Arrays.asList(1L, 2L, 3L));
        request.setIncidentId(incidentId);
        request.setPriority(level != null ? 6 - level : 3);
        request.setRegionCode(regionCode);
        request.setIncidentLevel(level);

        return sendNotification(request);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<Long> broadcastNotification(String title, String content,
                                            String regionCode, Integer incidentLevel) {
        List<Long> notificationIds = new ArrayList<>();

        List<NotificationChannel> allChannels = Arrays.asList(
                NotificationChannel.SMS, NotificationChannel.APP_PUSH, NotificationChannel.BROADCAST
        );

        for (NotificationChannel channel : allChannels) {
            NotificationSendRequest request = new NotificationSendRequest();
            request.setTitle(title);
            request.setContent(content);
            request.setSummary(content.substring(0, Math.min(100, content.length())));
            request.setChannels(Collections.singletonList(channel));
            request.setTargetType("REGION");
            request.setTargetIds(Arrays.asList(1L, 2L, 3L));
            request.setPriority(incidentLevel != null ? 6 - incidentLevel : 2);
            request.setRegionCode(regionCode);
            request.setIncidentLevel(incidentLevel);

            Long id = sendNotification(request);
            notificationIds.add(id);
        }

        log.info("广播通知完成: regionCode={}, notificationCount={}", regionCode, notificationIds.size());
        return notificationIds;
    }

    @Override
    public Notification getNotificationById(Long id) {
        return notificationMapper.selectById(id);
    }

    @Override
    public Notification getNotificationByNo(String notificationNo) {
        return notificationMapper.selectByNotificationNo(notificationNo);
    }

    @Override
    public List<Notification> getNotificationsByIncidentId(Long incidentId) {
        return notificationMapper.selectByIncidentId(incidentId);
    }

    @Override
    public List<NotificationReceipt> getReceiptsByNotificationId(Long notificationId) {
        return receiptMapper.selectByNotificationId(notificationId);
    }

    @Override
    public List<NotificationReceipt> getReceiptsByRecipientId(Long recipientId) {
        return receiptMapper.selectByRecipientId(recipientId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean confirmReceipt(Long receiptId) {
        NotificationReceipt receipt = receiptMapper.selectById(receiptId);
        if (receipt == null) {
            throw new BusinessException("回执记录不存在");
        }

        receipt.setStatus(NotificationStatus.READ);
        receipt.setReadAt(LocalDateTime.now());
        receiptMapper.updateById(receipt);

        notificationMapper.incrementReadCount(receipt.getNotificationId(), SecurityUtils.getCurrentUserId());

        log.info("通知已读确认: receiptId={}, notificationId={}", receiptId, receipt.getNotificationId());
        return true;
    }

    @Override
    public void processPendingNotifications() {
        List<Notification> pending = notificationMapper.selectPendingNotifications(100);
        for (Notification notification : pending) {
            asyncSendNotification(notification.getId());
        }
    }

    @Override
    public void checkAndUpdateStatus(Long notificationId) {
    }

    @Override
    public List<Notification> getUserNotifications(Long userId, int pageNum, int pageSize) {
        return notificationMapper.selectList(null);
    }
}
