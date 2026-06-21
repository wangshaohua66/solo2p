package com.gov.specialequipment.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.gov.specialequipment.entity.Device;
import com.gov.specialequipment.entity.HazardRecord;
import com.gov.specialequipment.entity.InspectionPlan;
import com.gov.specialequipment.entity.Notification;
import com.gov.specialequipment.enums.DeviceStatusEnum;
import com.gov.specialequipment.enums.HazardStatusEnum;
import com.gov.specialequipment.enums.RoleEnum;
import com.gov.specialequipment.mapper.DeviceMapper;
import com.gov.specialequipment.mapper.HazardRecordMapper;
import com.gov.specialequipment.mapper.InspectionPlanMapper;
import com.gov.specialequipment.mapper.NotificationMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduledTaskService {

    private final DeviceMapper deviceMapper;
    private final HazardRecordMapper hazardRecordMapper;
    private final InspectionPlanMapper inspectionPlanMapper;
    private final NotificationMapper notificationMapper;

    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void checkOverdueDevices() {
        log.info("开始执行每日超期设备检测任务...");
        LocalDate today = LocalDate.now();
        List<Device> overdueDevices = deviceMapper.selectOverdueDevices(today);

        int count = 0;
        for (Device device : overdueDevices) {
            if (!DeviceStatusEnum.OVERDUE.getCode().equals(device.getStatus())) {
                device.setStatus(DeviceStatusEnum.OVERDUE.getCode());
                deviceMapper.updateById(device);
                count++;

                Notification notification = new Notification();
                notification.setNotificationType("超期预警");
                notification.setTitle("设备超期未检预警");
                notification.setContent(String.format("设备[%s]已超期未检，请尽快安排检验。", device.getDeviceCode()));
                notification.setReceiverId(device.getUseUnitId());
                notification.setReceiverName(device.getUseUnitName());
                notification.setReceiverRole(RoleEnum.USE_UNIT.getCode());
                notification.setReadStatus(0);
                notification.setBizType("OVERDUE_DEVICE");
                notification.setBizId(device.getId());
                notificationMapper.insert(notification);
            }
        }
        log.info("每日超期设备检测任务完成，更新超期设备数量: {}", count);
    }

    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void sendInspectionWarning() {
        log.info("开始执行检验预警通知任务...");
        LocalDate today = LocalDate.now();
        LocalDate warningDate = today.plusDays(30);
        List<Device> warningDevices = deviceMapper.selectWarningDevices(today, warningDate);

        int count = 0;
        for (Device device : warningDevices) {
            long daysUntil = java.time.temporal.ChronoUnit.DAYS.between(today, device.getNextInspectionDate());
            if (daysUntil > 0 && daysUntil <= 30) {
                Notification notification = new Notification();
                notification.setNotificationType("检验预警");
                notification.setTitle("设备检验到期提醒");
                notification.setContent(String.format("设备[%s]还有%d天到期，请及时安排检验。",
                        device.getDeviceCode(), daysUntil));
                notification.setReceiverId(device.getUseUnitId());
                notification.setReceiverName(device.getUseUnitName());
                notification.setReceiverRole(RoleEnum.USE_UNIT.getCode());
                notification.setReadStatus(0);
                notification.setBizType("INSPECTION_WARNING");
                notification.setBizId(device.getId());
                notificationMapper.insert(notification);
                count++;
            }
        }
        log.info("检验预警通知任务完成，发送预警数量: {}", count);
    }

    @Scheduled(cron = "0 0 1 ? * MON")
    @Transactional(rollbackFor = Exception.class)
    public void generateWeeklyInspectionPlans() {
        log.info("开始执行周检验计划生成与推送任务...");
        LocalDate today = LocalDate.now();
        LocalDate weekEnd = today.plusDays(14);
        List<Device> devices = deviceMapper.selectWarningDevices(today, weekEnd);

        int count = 0;
        for (Device device : devices) {
            long existing = inspectionPlanMapper.selectCount(
                    new LambdaQueryWrapper<InspectionPlan>()
                            .eq(InspectionPlan::getDeviceId, device.getId())
                            .in(InspectionPlan::getStatus, 1, 2)
            );
            if (existing == 0) {
                InspectionPlan plan = new InspectionPlan();
                plan.setPlanNo("JH" + today.toString().replace("-", "") + String.format("%04d", count + 1));
                plan.setDeviceId(device.getId());
                plan.setDeviceCode(device.getDeviceCode());
                plan.setPlanDate(device.getNextInspectionDate().minusDays(15));
                plan.setStatus(1);
                plan.setPushTime(LocalDateTime.now());
                inspectionPlanMapper.insert(plan);
                count++;
            }
        }
        log.info("周检验计划生成任务完成，生成计划数量: {}", count);
    }

    @Scheduled(cron = "0 0 4 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void checkOverdueHazards() {
        log.info("开始执行每日逾期隐患检测任务...");
        LocalDate today = LocalDate.now();
        List<HazardRecord> overdueHazards = hazardRecordMapper.selectOverdueHazards(today);

        int count = 0;
        for (HazardRecord hazard : overdueHazards) {
            if (!HazardStatusEnum.OVERDUE.getCode().equals(hazard.getStatus())
                    && !HazardStatusEnum.ESCALATED.getCode().equals(hazard.getStatus())) {
                hazard.setStatus(HazardStatusEnum.OVERDUE.getCode());
                hazardRecordMapper.updateById(hazard);
                count++;

                Notification notification = new Notification();
                notification.setNotificationType("隐患督办");
                notification.setTitle("隐患整改逾期通知");
                notification.setContent(String.format("隐患编号[%s]已逾期未整改，请立即处理。", hazard.getHazardNo()));
                notification.setReceiverId(hazard.getUseUnitId());
                notification.setReceiverName(hazard.getUseUnitName());
                notification.setReceiverRole(RoleEnum.USE_UNIT.getCode());
                notification.setReadStatus(0);
                notification.setBizType("OVERDUE_HAZARD");
                notification.setBizId(hazard.getId());
                notificationMapper.insert(notification);
            }
        }
        log.info("每日逾期隐患检测任务完成，更新逾期隐患数量: {}", count);
    }

    @Scheduled(cron = "0 0 6 1 * ?")
    public void generateMonthlyReport() {
        log.info("开始执行月度统计报表生成任务...");
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.minusMonths(1).withDayOfMonth(1);
        LocalDate monthEnd = today.withDayOfMonth(1).minusDays(1);

        long totalDevices = deviceMapper.selectCount(new LambdaQueryWrapper<>());
        long overdueDevices = deviceMapper.selectOverdueDevices(today).size();
        long totalHazards = hazardRecordMapper.selectCount(new LambdaQueryWrapper<>());
        long overdueHazards = hazardRecordMapper.selectOverdueHazards(today).size();

        log.info("月度统计报表 - 统计周期: {} 至 {}", monthStart, monthEnd);
        log.info("设备总数: {}, 超期设备: {}", totalDevices, overdueDevices);
        log.info("隐患总数: {}, 逾期隐患: {}", totalHazards, overdueHazards);
        log.info("月度统计报表生成任务完成");
    }
}
