package com.talentmarket.common.service;

import cn.hutool.core.util.StrUtil;
import com.talentmarket.common.utils.SmsUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class SmsNotificationService {

    private final SmsUtils smsUtils;

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private static final String SMS_INTERVIEW_INVITE = "SMS_INTERVIEW_INVITE";
    private static final String SMS_INTERVIEW_REMIND = "SMS_INTERVIEW_REMIND";
    private static final String SMS_APPLICATION_STATUS = "SMS_APPLICATION_STATUS";
    private static final String SMS_ENTERPRISE_VERIFY = "SMS_ENTERPRISE_VERIFY";
    private static final String SMS_JOB_PUBLISHED = "SMS_JOB_PUBLISHED";
    private static final String SMS_VERIFICATION_CODE = "SMS_VERIFICATION_CODE";
    private static final String SMS_FAIR_REMIND = "SMS_FAIR_REMIND";

    private final Map<String, AtomicInteger> dailyCounters = new ConcurrentHashMap<>();
    private final Map<String, Long> lastSentTime = new ConcurrentHashMap<>();

    private static final int DAILY_LIMIT_PER_PHONE = 20;
    private static final long MIN_INTERVAL_MS = 60_000L;

    @Async
    public void sendInterviewInvitation(String phone, String jobseekerName, String companyName,
                                         String position, LocalDateTime interviewTime,
                                         String meetingLink) {
        if (!preCheck(phone, "面试邀请")) {
            return;
        }

        Map<String, String> params = new HashMap<>();
        params.put("name", StrUtil.blankToDefault(jobseekerName, "求职者"));
        params.put("company", companyName);
        params.put("position", position);
        params.put("time", interviewTime.format(DATE_TIME_FORMATTER));
        if (StrUtil.isNotBlank(meetingLink)) {
            params.put("link", meetingLink);
        }

        boolean success = smsUtils.sendSms(phone, SMS_INTERVIEW_INVITE, params);

        if (success) {
            afterSend(phone);
            log.info("面试邀请短信发送成功: 求职者={}, 职位={}, 企业={}", jobseekerName, position, companyName);
        } else {
            log.warn("面试邀请短信发送失败: 求职者={}, 手机号={}", jobseekerName, phone);
        }
    }

    @Async
    public void sendInterviewReminder(String phone, String jobseekerName, String companyName,
                                       String position, LocalDateTime interviewTime) {
        if (!preCheck(phone, "面试提醒")) {
            return;
        }

        Map<String, String> params = new HashMap<>();
        params.put("name", StrUtil.blankToDefault(jobseekerName, "求职者"));
        params.put("company", companyName);
        params.put("position", position);
        params.put("time", interviewTime.format(DATE_TIME_FORMATTER));
        long hoursUntil = java.time.Duration.between(LocalDateTime.now(), interviewTime).toHours();
        params.put("hours", String.valueOf(Math.max(1, hoursUntil)));

        boolean success = smsUtils.sendSms(phone, SMS_INTERVIEW_REMIND, params);

        if (success) {
            afterSend(phone);
            log.info("面试提醒短信发送成功: {} - {}", jobseekerName, position);
        }
    }

    @Async
    public void sendApplicationStatusNotification(String phone, String jobseekerName,
                                                   String position, String companyName,
                                                   String status, String message) {
        if (!preCheck(phone, "投递状态")) {
            return;
        }

        Map<String, String> params = new HashMap<>();
        params.put("name", StrUtil.blankToDefault(jobseekerName, "求职者"));
        params.put("position", position);
        params.put("company", companyName);
        params.put("status", status);
        if (StrUtil.isNotBlank(message)) {
            params.put("message", message);
        }

        boolean success = smsUtils.sendSms(phone, SMS_APPLICATION_STATUS, params);

        if (success) {
            afterSend(phone);
            log.info("投递状态通知短信发送成功: {} - {} - {}", jobseekerName, position, status);
        }
    }

    @Async
    public void sendEnterpriseVerifyNotification(String phone, String contactName,
                                                  String enterpriseName, boolean passed,
                                                  String rejectReason) {
        if (!preCheck(phone, "企业资质审核")) {
            return;
        }

        Map<String, String> params = new HashMap<>();
        params.put("name", StrUtil.blankToDefault(contactName, "联系人"));
        params.put("company", enterpriseName);
        params.put("result", passed ? "审核通过" : "审核未通过");
        params.put("status", passed ? "恭喜您的企业资质已通过平台审核，可以开始发布岗位信息"
                : "很遗憾，您的企业资质审核未通过：" + StrUtil.blankToDefault(rejectReason, "请补充完整资料后重新提交"));

        boolean success = smsUtils.sendSms(phone, SMS_ENTERPRISE_VERIFY, params);

        if (success) {
            afterSend(phone);
            log.info("企业资质审核短信发送成功: {} - {} - {}", contactName, enterpriseName, passed ? "通过" : "未通过");
        }
    }

    @Async
    public void sendJobPublishedNotification(String phone, String hrName,
                                              String enterpriseName, String position,
                                              int matchedCount) {
        if (!preCheck(phone, "岗位发布")) {
            return;
        }

        Map<String, String> params = new HashMap<>();
        params.put("name", StrUtil.blankToDefault(hrName, "HR"));
        params.put("company", enterpriseName);
        params.put("position", position);
        params.put("count", String.valueOf(matchedCount));

        boolean success = smsUtils.sendSms(phone, SMS_JOB_PUBLISHED, params);

        if (success) {
            afterSend(phone);
            log.info("岗位发布通知短信发送成功: {} - {} - {}", hrName, position, matchedCount);
        }
    }

    @Async
    public void sendVerificationCode(String phone, String code, String usage) {
        if (!preCheck(phone, "验证码")) {
            return;
        }

        Map<String, String> params = new HashMap<>();
        params.put("code", code);
        params.put("usage", StrUtil.blankToDefault(usage, "身份验证"));

        boolean success = smsUtils.sendSms(phone, SMS_VERIFICATION_CODE, params);

        if (success) {
            afterSend(phone);
            log.info("验证码短信发送成功: {} - {}", maskPhone(phone), usage);
        }
    }

    @Async
    public void sendRecruitmentFairReminder(String phone, String attendeeName,
                                             String fairName, LocalDateTime fairTime,
                                             String location, String boothNo) {
        if (!preCheck(phone, "招聘会提醒")) {
            return;
        }

        Map<String, String> params = new HashMap<>();
        params.put("name", StrUtil.blankToDefault(attendeeName, "参会者"));
        params.put("fairName", fairName);
        params.put("time", fairTime.format(DATE_TIME_FORMATTER));
        params.put("location", location);
        if (StrUtil.isNotBlank(boothNo)) {
            params.put("booth", boothNo);
        }

        boolean success = smsUtils.sendSms(phone, SMS_FAIR_REMIND, params);

        if (success) {
            afterSend(phone);
            log.info("招聘会提醒短信发送成功: {} - {}", attendeeName, fairName);
        }
    }

    private boolean preCheck(String phone, String scene) {
        if (StrUtil.isBlank(phone)) {
            log.warn("[{}] 短信发送失败：手机号为空", scene);
            return false;
        }

        if (!isValidPhone(phone)) {
            log.warn("[{}] 短信发送失败：手机号格式不正确 - {}", scene, maskPhone(phone));
            return false;
        }

        long now = System.currentTimeMillis();
        String phoneKey = maskPhone(phone);

        Long lastTime = lastSentTime.get(phone);
        if (lastTime != null && (now - lastTime) < MIN_INTERVAL_MS) {
            log.warn("[{}] 短信发送过于频繁，已拦截 - {}", scene, phoneKey);
            return false;
        }

        AtomicInteger counter = dailyCounters.computeIfAbsent(phone, k -> new AtomicInteger(0));
        if (counter.get() >= DAILY_LIMIT_PER_PHONE) {
            log.warn("[{}] 短信发送超过每日限制，已拦截 - {}", scene, phoneKey);
            return false;
        }

        return true;
    }

    private void afterSend(String phone) {
        lastSentTime.put(phone, System.currentTimeMillis());
        AtomicInteger counter = dailyCounters.computeIfAbsent(phone, k -> new AtomicInteger(0));
        counter.incrementAndGet();
    }

    private boolean isValidPhone(String phone) {
        if (phone == null) return false;
        return phone.matches("^1[3-9]\\d{9}$");
    }

    private String maskPhone(String phone) {
        if (StrUtil.isBlank(phone) || phone.length() < 7) {
            return "***";
        }
        return phone.substring(0, 3) + "****" + phone.substring(7);
    }
}
