package com.iccert.task.schedule;

import com.iccert.task.entity.InspectionTask;
import com.iccert.task.entity.Notification;
import com.iccert.task.mapper.InspectionTaskMapper;
import com.iccert.task.mapper.NotificationMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 检测任务超期自动升级提醒。
 * 定时扫描所有超期未提醒的任务，向任务负责人和管理员发送升级通知，
 * 并标记 is_overdue_warned = 1 避免重复提醒。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OverdueTaskSchedule {

    private final InspectionTaskMapper taskMapper;
    private final NotificationMapper notificationMapper;

    /**
     * 每小时执行一次超期扫描。
     * cron: 秒 分 时 日 月 周
     */
    @Scheduled(cron = "0 0 * * * ?")
    public void scanOverdueTasks() {
        List<InspectionTask> overdueTasks = taskMapper.selectOverdueTasks();
        if (overdueTasks == null || overdueTasks.isEmpty()) {
            log.debug("[超期扫描] 当前无超期未提醒任务");
            return;
        }
        log.info("[超期扫描] 发现 {} 个超期未提醒任务, 开始触发升级通知", overdueTasks.size());
        for (InspectionTask task : overdueTasks) {
            try {
                sendOverdueNotification(task);
                taskMapper.markOverdueWarned(task.getId());
            } catch (Exception e) {
                log.error("[超期扫描] 任务{}升级通知发送失败", task.getId(), e);
            }
        }
        log.info("[超期扫描] 超期任务升级提醒处理完成, 共处理{}条", overdueTasks.size());
    }

    /**
     * 向任务负责人推送通知，同时向 ADMIN 角色发送升级抄送。
     */
    private void sendOverdueNotification(InspectionTask task) {
        int overdueDays = task.getDeadline() != null
                ? Math.toIntExact(LocalDate.now().toEpochDay() - task.getDeadline().toEpochDay())
                : 0;

        String title = "【超期升级】检测任务 " + task.getTaskCode() + " 已超期" + overdueDays + "天";
        String content = String.format(
                "检测任务[%s]标题[%s]已超过截止日期(%s)，超期%d天，请立即处理或申请延期。\n" +
                        "关联样品: %s, 负责人: %s, 优先级: %s",
                task.getTaskCode(),
                task.getTaskTitle() != null ? task.getTaskTitle() : "-",
                task.getDeadline() != null ? task.getDeadline().toString() : "-",
                overdueDays,
                task.getSampleCode() != null ? task.getSampleCode() : "-",
                task.getTechnicianName() != null ? task.getTechnicianName() : "未分配",
                task.getPriority() != null ? task.getPriority() : "NORMAL"
        );

        if (task.getTechnicianId() != null) {
            Notification userNotif = buildNotification(title, content, task);
            userNotif.setTargetUserId(task.getTechnicianId());
            notificationMapper.insert(userNotif);
        }

        Notification adminNotif = buildNotification(title, content, task);
        adminNotif.setTargetRoleCode("ADMIN");
        notificationMapper.insert(adminNotif);

        log.warn("[超期升级] 任务{}({})超期{}天, 已通知负责人{}及管理员",
                task.getId(), task.getTaskCode(), overdueDays, task.getTechnicianName());
    }

    private Notification buildNotification(String title, String content, InspectionTask task) {
        Notification n = new Notification();
        n.setNotificationType("OVERDUE");
        n.setTitle(title);
        n.setContent(content);
        n.setBizType("TASK");
        n.setBizId(task.getId() != null ? task.getId().toString() : null);
        n.setPriority("HIGH");
        n.setIsRead(0);
        n.setIsPushSent(0);
        n.setIsEmailSent(0);
        n.setCreateTime(LocalDateTime.now());
        return n;
    }
}
