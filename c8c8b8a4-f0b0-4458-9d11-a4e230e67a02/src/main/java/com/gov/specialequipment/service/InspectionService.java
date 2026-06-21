package com.gov.specialequipment.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.gov.specialequipment.common.PageResult;
import com.gov.specialequipment.dto.InspectionPlanQueryDTO;
import com.gov.specialequipment.dto.InspectionQueryDTO;
import com.gov.specialequipment.dto.InspectionReportDTO;
import com.gov.specialequipment.entity.Device;
import com.gov.specialequipment.entity.InspectionAgency;
import com.gov.specialequipment.entity.InspectionPlan;
import com.gov.specialequipment.entity.InspectionRecord;
import com.gov.specialequipment.entity.Notification;
import com.gov.specialequipment.enums.DeviceStatusEnum;
import com.gov.specialequipment.enums.DeviceTypeEnum;
import com.gov.specialequipment.enums.InspectionConclusionEnum;
import com.gov.specialequipment.enums.RoleEnum;
import com.gov.specialequipment.exception.BusinessException;
import com.gov.specialequipment.mapper.DeviceMapper;
import com.gov.specialequipment.mapper.InspectionAgencyMapper;
import com.gov.specialequipment.mapper.InspectionPlanMapper;
import com.gov.specialequipment.mapper.InspectionRecordMapper;
import com.gov.specialequipment.mapper.NotificationMapper;
import com.gov.specialequipment.util.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
public class InspectionService {

    private final InspectionRecordMapper inspectionRecordMapper;
    private final InspectionPlanMapper inspectionPlanMapper;
    private final DeviceMapper deviceMapper;
    private final InspectionAgencyMapper inspectionAgencyMapper;
    private final NotificationMapper notificationMapper;

    private final AtomicLong reportSeq = new AtomicLong(1);
    private final AtomicLong planSeq = new AtomicLong(1);

    @Transactional(rollbackFor = Exception.class)
    public InspectionRecord receiveReport(InspectionReportDTO dto) {
        validateInspectionReport(dto);

        Device device = deviceMapper.selectById(dto.getDeviceId());
        if (device == null) {
            throw new BusinessException("设备不存在");
        }

        Long agencyId = SecurityUtil.getCurrentOrganizationId();
        String agencyName = SecurityUtil.getCurrentRealName() != null
                ? SecurityUtil.getCurrentRealName() : "系统";
        if (RoleEnum.INSPECTION_AGENCY.getCode().equals(SecurityUtil.getCurrentRoleCode())) {
            if (agencyId != null) {
                InspectionAgency agency = inspectionAgencyMapper.selectById(agencyId);
                if (agency != null) {
                    agencyName = agency.getAgencyName();
                }
            }
        }

        InspectionConclusionEnum conclusionEnum = null;
        for (InspectionConclusionEnum e : InspectionConclusionEnum.values()) {
            if (e.getCode().equals(dto.getConclusion())) {
                conclusionEnum = e;
                break;
            }
        }
        if (conclusionEnum == null) {
            throw new BusinessException("无效的检验结论");
        }

        InspectionRecord record = new InspectionRecord();
        BeanUtils.copyProperties(dto, record);
        record.setDeviceCode(device.getDeviceCode());
        record.setDeviceType(device.getDeviceType());
        record.setAgencyId(agencyId);
        record.setAgencyName(agencyName);
        record.setReceiveTime(LocalDateTime.now());
        record.setStatus(1);

        if (dto.getNextInspectionDate() == null) {
            record.setNextInspectionDate(calculateNextInspectionDate(device.getDeviceType(), dto.getInspectionDate()));
        }

        inspectionRecordMapper.insert(record);

        device.setLastInspectionDate(dto.getInspectionDate());
        device.setNextInspectionDate(record.getNextInspectionDate());
        if (InspectionConclusionEnum.DISQUALIFIED.getCode().equals(dto.getConclusion())) {
            device.setStatus(DeviceStatusEnum.STOPPED.getCode());
        } else if (InspectionConclusionEnum.QUALIFIED.getCode().equals(dto.getConclusion())) {
            device.setStatus(DeviceStatusEnum.NORMAL.getCode());
        } else if (InspectionConclusionEnum.RECTIFICATION.getCode().equals(dto.getConclusion())) {
            device.setStatus(DeviceStatusEnum.PENDING_INSPECTION.getCode());
        }
        deviceMapper.updateById(device);

        if (InspectionConclusionEnum.RECTIFICATION.getCode().equals(dto.getConclusion())
                || InspectionConclusionEnum.DISQUALIFIED.getCode().equals(dto.getConclusion())) {
            sendInspectionNotification(device, conclusionEnum);
        }

        return record;
    }

    private LocalDate calculateNextInspectionDate(Integer deviceType, LocalDate lastDate) {
        DeviceTypeEnum typeEnum = DeviceTypeEnum.getByCode(deviceType);
        int months = 12;
        if (typeEnum != null) {
            switch (typeEnum) {
                case ELEVATOR:
                case CRANE:
                case AMUSEMENT:
                    months = 12;
                    break;
                case PRESSURE_VESSEL:
                case BOILER:
                    months = 24;
                    break;
                case ROPEWAY:
                    months = 12;
                    break;
                default:
                    months = 12;
            }
        }
        return lastDate.plusMonths(months);
    }

    private void validateInspectionReport(InspectionReportDTO dto) {
        if (dto.getInspectionDate().isAfter(LocalDate.now())) {
            throw new BusinessException("检验日期不能晚于当前日期");
        }
        if (dto.getNextInspectionDate() != null && dto.getNextInspectionDate().isBefore(dto.getInspectionDate())) {
            throw new BusinessException("下次检验日期不能早于检验日期");
        }
    }

    private void sendInspectionNotification(Device device, InspectionConclusionEnum conclusion) {
        Notification notification = new Notification();
        notification.setNotificationType("检验预警");
        notification.setTitle("设备检验结果通知");
        notification.setContent(String.format("设备[%s]检验结论为：%s，请及时处理。",
                device.getDeviceCode(), conclusion.getDesc()));
        notification.setReceiverId(device.getUseUnitId());
        notification.setReceiverName(device.getUseUnitName());
        notification.setReceiverRole(RoleEnum.USE_UNIT.getCode());
        notification.setReadStatus(0);
        notification.setBizType("INSPECTION");
        notification.setBizId(device.getId());
        notificationMapper.insert(notification);
    }

    public InspectionRecord getInspectionById(Long id) {
        InspectionRecord record = inspectionRecordMapper.selectById(id);
        checkDataPermission(record);
        return record;
    }

    public PageResult<InspectionRecord> queryInspections(InspectionQueryDTO dto) {
        Page<InspectionRecord> page = new Page<>(dto.getCurrent(), dto.getSize());

        LambdaQueryWrapper<InspectionRecord> wrapper = new LambdaQueryWrapper<>();

        String roleCode = SecurityUtil.getCurrentRoleCode();
        if (RoleEnum.INSPECTION_AGENCY.getCode().equals(roleCode)) {
            Long orgId = SecurityUtil.getCurrentOrganizationId();
            if (orgId != null) {
                wrapper.eq(InspectionRecord::getAgencyId, orgId);
            }
        } else if (RoleEnum.USE_UNIT.getCode().equals(roleCode)) {
            Long orgId = SecurityUtil.getCurrentOrganizationId();
            if (orgId != null) {
                List<Device> devices = deviceMapper.selectList(
                        new LambdaQueryWrapper<Device>().eq(Device::getUseUnitId, orgId)
                );
                if (!devices.isEmpty()) {
                    List<Long> deviceIds = devices.stream().map(Device::getId).toList();
                    wrapper.in(InspectionRecord::getDeviceId, deviceIds);
                } else {
                    return new PageResult<>(List.of(), 0L, dto.getCurrent(), dto.getSize());
                }
            }
        }

        if (dto.getInspectionNo() != null && !dto.getInspectionNo().isEmpty()) {
            wrapper.like(InspectionRecord::getInspectionNo, dto.getInspectionNo());
        }
        if (dto.getDeviceId() != null) {
            wrapper.eq(InspectionRecord::getDeviceId, dto.getDeviceId());
        }
        if (dto.getDeviceCode() != null && !dto.getDeviceCode().isEmpty()) {
            wrapper.like(InspectionRecord::getDeviceCode, dto.getDeviceCode());
        }
        if (dto.getDeviceType() != null) {
            wrapper.eq(InspectionRecord::getDeviceType, dto.getDeviceType());
        }
        if (dto.getAgencyId() != null) {
            wrapper.eq(InspectionRecord::getAgencyId, dto.getAgencyId());
        }
        if (dto.getConclusion() != null) {
            wrapper.eq(InspectionRecord::getConclusion, dto.getConclusion());
        }
        if (dto.getStatus() != null) {
            wrapper.eq(InspectionRecord::getStatus, dto.getStatus());
        }
        if (dto.getStartDate() != null) {
            wrapper.ge(InspectionRecord::getInspectionDate, dto.getStartDate());
        }
        if (dto.getEndDate() != null) {
            wrapper.le(InspectionRecord::getInspectionDate, dto.getEndDate());
        }

        wrapper.orderByDesc(InspectionRecord::getInspectionDate);

        Page<InspectionRecord> result = inspectionRecordMapper.selectPage(page, wrapper);
        return new PageResult<>(result.getRecords(), result.getTotal(), result.getCurrent(), result.getSize());
    }

    public List<InspectionRecord> getInspectionHistory(Long deviceId) {
        return inspectionRecordMapper.selectList(
                new LambdaQueryWrapper<InspectionRecord>()
                        .eq(InspectionRecord::getDeviceId, deviceId)
                        .orderByDesc(InspectionRecord::getInspectionDate)
        );
    }

    @Transactional(rollbackFor = Exception.class)
    public InspectionPlan createInspectionPlan(Long deviceId, Long agencyId, LocalDate planDate) {
        Device device = deviceMapper.selectById(deviceId);
        if (device == null) {
            throw new BusinessException("设备不存在");
        }

        InspectionAgency agency = null;
        String agencyName = "";
        if (agencyId != null) {
            agency = inspectionAgencyMapper.selectById(agencyId);
            if (agency == null) {
                throw new BusinessException("检验机构不存在");
            }
            agencyName = agency.getAgencyName();
        }

        String planNo = "JH" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
                + String.format("%04d", planSeq.getAndIncrement() % 10000);

        InspectionPlan plan = new InspectionPlan();
        plan.setPlanNo(planNo);
        plan.setDeviceId(deviceId);
        plan.setDeviceCode(device.getDeviceCode());
        plan.setAgencyId(agencyId);
        plan.setAgencyName(agencyName);
        plan.setPlanDate(planDate);
        plan.setStatus(1);
        inspectionPlanMapper.insert(plan);

        return plan;
    }

    public PageResult<InspectionPlan> queryInspectionPlans(InspectionPlanQueryDTO dto) {
        Page<InspectionPlan> page = new Page<>(dto.getCurrent(), dto.getSize());
        LambdaQueryWrapper<InspectionPlan> wrapper = new LambdaQueryWrapper<>();

        if (dto.getPlanNo() != null && !dto.getPlanNo().isEmpty()) {
            wrapper.like(InspectionPlan::getPlanNo, dto.getPlanNo());
        }
        if (dto.getDeviceId() != null) {
            wrapper.eq(InspectionPlan::getDeviceId, dto.getDeviceId());
        }
        if (dto.getDeviceCode() != null && !dto.getDeviceCode().isEmpty()) {
            wrapper.like(InspectionPlan::getDeviceCode, dto.getDeviceCode());
        }
        if (dto.getAgencyId() != null) {
            wrapper.eq(InspectionPlan::getAgencyId, dto.getAgencyId());
        }
        if (dto.getStatus() != null) {
            wrapper.eq(InspectionPlan::getStatus, dto.getStatus());
        }
        if (dto.getPlanDateStart() != null) {
            wrapper.ge(InspectionPlan::getPlanDate, dto.getPlanDateStart());
        }
        if (dto.getPlanDateEnd() != null) {
            wrapper.le(InspectionPlan::getPlanDate, dto.getPlanDateEnd());
        }
        wrapper.orderByDesc(InspectionPlan::getPlanDate);

        Page<InspectionPlan> result = inspectionPlanMapper.selectPage(page, wrapper);
        return new PageResult<>(result.getRecords(), result.getTotal(), result.getCurrent(), result.getSize());
    }

    public List<Device> getOverdueWarningDevices() {
        LocalDate now = LocalDate.now();
        LocalDate warningDate = now.plusDays(30);
        return deviceMapper.selectWarningDevices(now, warningDate);
    }

    public List<Device> getOverdueDevices() {
        return deviceMapper.selectOverdueDevices(LocalDate.now());
    }

    private void checkDataPermission(InspectionRecord record) {
        if (record == null) return;
        String roleCode = SecurityUtil.getCurrentRoleCode();
        if (RoleEnum.INSPECTION_AGENCY.getCode().equals(roleCode)) {
            Long orgId = SecurityUtil.getCurrentOrganizationId();
            if (orgId != null && !orgId.equals(record.getAgencyId())) {
                throw new BusinessException("无权限访问该检验数据");
            }
        } else if (RoleEnum.USE_UNIT.getCode().equals(roleCode)) {
            Device device = deviceMapper.selectById(record.getDeviceId());
            Long orgId = SecurityUtil.getCurrentOrganizationId();
            if (device != null && orgId != null && !orgId.equals(device.getUseUnitId())) {
                throw new BusinessException("无权限访问该检验数据");
            }
        }
    }
}
