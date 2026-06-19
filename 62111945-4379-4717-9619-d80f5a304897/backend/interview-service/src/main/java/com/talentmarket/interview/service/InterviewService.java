package com.talentmarket.interview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.talentmarket.common.exception.BusinessException;
import com.talentmarket.common.service.SmsNotificationService;
import com.talentmarket.interview.entity.Interview;
import com.talentmarket.interview.mapper.InterviewMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewService {

    private final InterviewMapper interviewMapper;
    private final SmsNotificationService smsNotificationService;
    private final RedisTemplate<String, Object> redisTemplate;

    private static final String ROOM_ID_PREFIX = "interview-room:";
    private static final String CENTER_ID = "interview-center-001";
    private static final String FAIR_REMIND_KEY = "interview:fair-remind:";

    public Interview getById(Long id) {
        return interviewMapper.selectById(id);
    }

    public IPage<Interview> list(int page, int pageSize, Long enterpriseId,
                                  Long jobseekerId, String status, Integer type) {
        LambdaQueryWrapper<Interview> wrapper = new LambdaQueryWrapper<>();
        if (enterpriseId != null) {
            wrapper.eq(Interview::getEnterpriseId, enterpriseId);
        }
        if (jobseekerId != null) {
            wrapper.eq(Interview::getJobseekerId, jobseekerId);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Interview::getStatus, status);
        }
        if (type != null) {
            wrapper.eq(Interview::getInterviewType, type);
        }
        wrapper.orderByDesc(Interview::getInterviewTime);
        return interviewMapper.selectPage(new Page<>(page, pageSize), wrapper);
    }

    @Transactional(rollbackFor = Exception.class)
    public Interview create(Interview interview) {
        if (interview.getInterviewTime() == null) {
            throw new BusinessException("请选择面试时间");
        }
        if (interview.getInterviewTime().isBefore(LocalDateTime.now().plusMinutes(15))) {
            throw new BusinessException("面试时间需至少提前15分钟");
        }

        interview.setStatus("pending");
        interview.setRoomId(generateRoomId());
        interview.setCreateTime(LocalDateTime.now());

        if (interview.getInterviewType() == null) {
            interview.setInterviewType(1);
        }

        interviewMapper.insert(interview);
        log.info("创建面试成功，面试ID: {}, 房间: {}, 职位: {}, 时间: {}",
                interview.getId(), interview.getRoomId(),
                interview.getJobTitle(), interview.getInterviewTime());

        sendInterviewInviteNotifications(interview);

        broadcastInterviewCreated(interview, "CREATE");

        return interview;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean update(Long id, Interview interview) {
        interview.setId(id);
        boolean hasChange = interview.getInterviewTime() != null || interview.getLocation() != null;

        int result = interviewMapper.updateById(interview);
        if (result > 0) {
            Interview full = interviewMapper.selectById(id);
            if (hasChange && "pending".equals(full.getStatus())) {
                smsNotificationService.sendInterviewReminder(
                        full.getJobseekerPhone(),
                        full.getJobseekerName(),
                        full.getEnterpriseName(),
                        full.getJobTitle(),
                        full.getInterviewTime()
                );
            }
            broadcastInterviewCreated(full, "UPDATE");
        }
        return result > 0;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean confirm(Long id, boolean accepted, String rejectReason) {
        Interview interview = interviewMapper.selectById(id);
        if (interview == null) {
            throw new BusinessException("面试不存在");
        }

        Interview update = new Interview();
        update.setId(id);
        update.setStatus(accepted ? "confirmed" : "rejected");
        update.setConfirmTime(LocalDateTime.now());
        if (!accepted && rejectReason != null) {
            update.setRejectReason(rejectReason);
        }

        int result = interviewMapper.updateById(update);
        if (result > 0) {
            log.info("面试{}，面试ID: {}", accepted ? "已确认" : "已拒绝", id);

            String applicantStatus = accepted ? "面试已确认" : "面试被拒绝";
            if (interview.getJobseekerPhone() != null) {
                smsNotificationService.sendApplicationStatusNotification(
                        interview.getJobseekerPhone(),
                        interview.getJobseekerName(),
                        interview.getJobTitle(),
                        interview.getEnterpriseName(),
                        applicantStatus,
                        null
                );
            }
            if (accepted && interview.getInterviewType() == 1) {
                smsNotificationService.sendInterviewReminder(
                        interview.getJobseekerPhone(),
                        interview.getJobseekerName(),
                        interview.getEnterpriseName(),
                        interview.getJobTitle(),
                        interview.getInterviewTime()
                );
            }

            broadcastInterviewCreated(interview, accepted ? "UPDATE" : "UPDATE");
        }
        return result > 0;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean complete(Long id, String result, Integer rating) {
        Interview update = new Interview();
        update.setId(id);
        update.setStatus("completed");
        update.setResult(result);
        update.setRating(rating);
        update.setEndTime(LocalDateTime.now());

        int updated = interviewMapper.updateById(update);
        if (updated > 0) {
            log.info("面试已完成，面试ID: {}", id);
            Interview interview = interviewMapper.selectById(id);
            broadcastInterviewCreated(interview, "UPDATE");
        }
        return updated > 0;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean cancel(Long id, String reason, String cancelBy) {
        Interview update = new Interview();
        update.setId(id);
        update.setStatus("cancelled");
        update.setCancelReason(reason);
        update.setCancelBy(cancelBy);
        update.setCancelTime(LocalDateTime.now());

        int result = interviewMapper.updateById(update);
        if (result > 0) {
            Interview interview = interviewMapper.selectById(id);
            log.info("面试已取消，面试ID: {}, 原因: {}", id, reason);

            if ("enterprise".equals(cancelBy) && interview.getJobseekerPhone() != null) {
                smsNotificationService.sendApplicationStatusNotification(
                        interview.getJobseekerPhone(),
                        interview.getJobseekerName(),
                        interview.getJobTitle(),
                        interview.getEnterpriseName(),
                        "面试已取消",
                        "原因：" + reason
                );
            }

            broadcastInterviewCreated(interview, "UPDATE");
        }
        return result > 0;
    }

    private void sendInterviewInviteNotifications(Interview interview) {
        try {
            if (interview.getJobseekerPhone() != null) {
                String meetingLink = buildMeetingLink(interview);
                smsNotificationService.sendInterviewInvitation(
                        interview.getJobseekerPhone(),
                        interview.getJobseekerName(),
                        interview.getEnterpriseName(),
                        interview.getJobTitle(),
                        interview.getInterviewTime(),
                        meetingLink
                );
                log.info("已发送面试邀请短信给求职者: {}", maskPhone(interview.getJobseekerPhone()));
            }
        } catch (Exception e) {
            log.warn("发送面试邀请短信失败", e);
        }

        try {
            if (interview.getHrPhone() != null) {
                smsNotificationService.sendInterviewReminder(
                        interview.getHrPhone(),
                        interview.getHrName() != null ? interview.getHrName() : "HR",
                        interview.getEnterpriseName(),
                        interview.getJobTitle(),
                        interview.getInterviewTime()
                );
            }
        } catch (Exception e) {
            log.warn("发送面试提醒短信给HR失败", e);
        }
    }

    @Async
    public void scheduleFairReminder(Long fairId, String fairName, String attendeeName,
                                     String phone, LocalDateTime fairTime,
                                     String location, String boothNo) {
        try {
            String key = FAIR_REMIND_KEY + fairId + ":" + phone;
            Boolean alreadySent = redisTemplate.hasKey(key);
            if (Boolean.TRUE.equals(alreadySent)) {
                return;
            }

            long hoursUntil = java.time.Duration.between(LocalDateTime.now(), fairTime).toHours();
            if (hoursUntil <= 24) {
                smsNotificationService.sendRecruitmentFairReminder(
                        phone, attendeeName, fairName, fairTime, location, boothNo
                );
                redisTemplate.opsForValue().set(key, LocalDateTime.now().toString(),
                        hoursUntil + 2, TimeUnit.HOURS);
                log.info("招聘会提醒已发送，招聘会: {}, 参会人: {}", fairName, maskPhone(phone));
            }
        } catch (Exception e) {
            log.warn("发送招聘会提醒失败", e);
        }
    }

    @Async
    public void notifyApplicationStatus(String phone, String jobseekerName,
                                         String position, String company,
                                         String status, String message) {
        smsNotificationService.sendApplicationStatusNotification(
                phone, jobseekerName, position, company, status, message
        );
        log.info("投递状态变更通知已发送: {} - {} -> {}", maskPhone(phone), position, status);
    }

    private String generateRoomId() {
        String timestamp = String.valueOf(System.currentTimeMillis()).substring(6);
        String random = String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
        return "room-" + timestamp + "-" + random;
    }

    private String buildMeetingLink(Interview interview) {
        if (interview.getInterviewType() != null && interview.getInterviewType() == 1) {
            return "/interview/room/" + interview.getRoomId();
        }
        return null;
    }

    private void broadcastInterviewCreated(Interview interview, String operation) {
        try {
            String syncChannel = "talent-market:data-sync";
            Map<String, Object> interviewData = cn.hutool.json.JSONUtil.parseObj(
                    cn.hutool.json.JSONUtil.toJsonStr(interview)).toBean(Map.class);

            String payload = cn.hutool.json.JSONUtil.toJsonStr(Map.of(
                    "syncId", "interview-" + interview.getId() + "-" + System.currentTimeMillis(),
                    "sourceCenterId", CENTER_ID,
                    "syncType", "SINGLE",
                    "dataType", "interview",
                    "dataId", String.valueOf(interview.getId()),
                    "dataJson", cn.hutool.json.JSONUtil.toJsonStr(interviewData),
                    "operation", operation,
                    "timestamp", LocalDateTime.now().toString(),
                    "version", 1
            ));

            redisTemplate.convertAndSend(syncChannel, payload);
            log.debug("已广播面试事件到跨中心: interviewId={}, op={}", interview.getId(), operation);
        } catch (Exception e) {
            log.warn("广播面试事件失败", e);
        }
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) return "***";
        return phone.substring(0, 3) + "****" + phone.substring(7);
    }
}
