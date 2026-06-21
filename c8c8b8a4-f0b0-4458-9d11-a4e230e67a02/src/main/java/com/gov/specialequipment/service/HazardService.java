package com.gov.specialequipment.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.gov.specialequipment.common.PageResult;
import com.gov.specialequipment.dto.HazardCreateDTO;
import com.gov.specialequipment.dto.HazardQueryDTO;
import com.gov.specialequipment.dto.HazardRectifyDTO;
import com.gov.specialequipment.dto.HazardReviewDTO;
import com.gov.specialequipment.entity.Device;
import com.gov.specialequipment.entity.HazardRecord;
import com.gov.specialequipment.entity.Notification;
import com.gov.specialequipment.enums.HazardLevelEnum;
import com.gov.specialequipment.enums.HazardStatusEnum;
import com.gov.specialequipment.enums.RoleEnum;
import com.gov.specialequipment.exception.BusinessException;
import com.gov.specialequipment.mapper.DeviceMapper;
import com.gov.specialequipment.mapper.HazardRecordMapper;
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
public class HazardService {

    private final HazardRecordMapper hazardRecordMapper;
    private final DeviceMapper deviceMapper;
    private final NotificationMapper notificationMapper;

    private final AtomicLong hazardSeq = new AtomicLong(1);

    @Transactional(rollbackFor = Exception.class)
    public HazardRecord createHazard(HazardCreateDTO dto) {
        validateHazardParams(dto);

        HazardLevelEnum levelEnum = HazardLevelEnum.getByCode(dto.getHazardLevel());
        if (levelEnum == null) {
            throw new BusinessException("无效的隐患等级");
        }

        Device device = null;
        Long useUnitId = null;
        String useUnitName = "";
        String deviceCode = "";
        Integer deviceType = dto.getDeviceType();

        if (dto.getDeviceId() != null) {
            device = deviceMapper.selectById(dto.getDeviceId());
            if (device == null) {
                throw new BusinessException("设备不存在");
            }
            useUnitId = device.getUseUnitId();
            useUnitName = device.getUseUnitName();
            deviceCode = device.getDeviceCode();
            deviceType = device.getDeviceType();
        }

        String hazardNo = "YH" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
                + String.format("%04d", hazardSeq.getAndIncrement() % 10000);

        HazardRecord hazard = new HazardRecord();
        BeanUtils.copyProperties(dto, hazard);
        hazard.setHazardNo(hazardNo);
        hazard.setDeviceCode(deviceCode);
        hazard.setDeviceType(deviceType);
        hazard.setUseUnitId(useUnitId);
        hazard.setUseUnitName(useUnitName);
        hazard.setDeadline(dto.getDiscoveryDate().plusDays(levelEnum.getDeadlineDays()));
        hazard.setDiscoverer(dto.getDiscoverer() != null ? dto.getDiscoverer() : SecurityUtil.getCurrentRealName());
        hazard.setDiscovererId(SecurityUtil.getCurrentUserId());
        hazard.setStatus(HazardStatusEnum.PENDING.getCode());
        hazard.setEscalated(0);
        hazardRecordMapper.insert(hazard);

        sendHazardNotification(hazard, levelEnum);

        return hazard;
    }

    private void validateHazardParams(HazardCreateDTO dto) {
        HazardLevelEnum levelEnum = HazardLevelEnum.getByCode(dto.getHazardLevel());
        if (levelEnum == null) {
            throw new BusinessException("无效的隐患等级");
        }
        if (dto.getDiscoveryDate().isAfter(LocalDate.now())) {
            throw new BusinessException("发现日期不能晚于当前日期");
        }
    }

    private void sendHazardNotification(HazardRecord hazard, HazardLevelEnum levelEnum) {
        Notification notification = new Notification();
        notification.setNotificationType("隐患通知");
        notification.setTitle("新隐患待整改通知");
        notification.setContent(String.format("发现%s：编号[%s]，等级：%s，请于%s前完成整改。",
                levelEnum.getDesc(), hazard.getHazardNo(), levelEnum.getDesc(),
                hazard.getDeadline().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))));
        notification.setReceiverId(hazard.getUseUnitId());
        notification.setReceiverName(hazard.getUseUnitName());
        notification.setReceiverRole(RoleEnum.USE_UNIT.getCode());
        notification.setReadStatus(0);
        notification.setBizType("HAZARD");
        notification.setBizId(hazard.getId());
        notificationMapper.insert(notification);
    }

    public HazardRecord getHazardById(Long id) {
        HazardRecord hazard = hazardRecordMapper.selectById(id);
        checkDataPermission(hazard);
        return hazard;
    }

    public PageResult<HazardRecord> queryHazards(HazardQueryDTO dto) {
        Page<HazardRecord> page = new Page<>(dto.getCurrent(), dto.getSize());
        LambdaQueryWrapper<HazardRecord> wrapper = new LambdaQueryWrapper<>();

        String roleCode = SecurityUtil.getCurrentRoleCode();
        if (RoleEnum.USE_UNIT.getCode().equals(roleCode)) {
            Long orgId = SecurityUtil.getCurrentOrganizationId();
            if (orgId != null) {
                wrapper.eq(HazardRecord::getUseUnitId, orgId);
            }
        }

        if (dto.getHazardNo() != null && !dto.getHazardNo().isEmpty()) {
            wrapper.like(HazardRecord::getHazardNo, dto.getHazardNo());
        }
        if (dto.getDeviceId() != null) {
            wrapper.eq(HazardRecord::getDeviceId, dto.getDeviceId());
        }
        if (dto.getDeviceCode() != null && !dto.getDeviceCode().isEmpty()) {
            wrapper.like(HazardRecord::getDeviceCode, dto.getDeviceCode());
        }
        if (dto.getDeviceType() != null) {
            wrapper.eq(HazardRecord::getDeviceType, dto.getDeviceType());
        }
        if (dto.getUseUnitId() != null) {
            wrapper.eq(HazardRecord::getUseUnitId, dto.getUseUnitId());
        }
        if (dto.getHazardLevel() != null) {
            wrapper.eq(HazardRecord::getHazardLevel, dto.getHazardLevel());
        }
        if (dto.getStatus() != null) {
            wrapper.eq(HazardRecord::getStatus, dto.getStatus());
        }
        if (dto.getStartDate() != null) {
            wrapper.ge(HazardRecord::getDiscoveryDate, dto.getStartDate());
        }
        if (dto.getEndDate() != null) {
            wrapper.le(HazardRecord::getDiscoveryDate, dto.getEndDate());
        }
        if (dto.getEscalated() != null) {
            wrapper.eq(HazardRecord::getEscalated, dto.getEscalated() ? 1 : 0);
        }

        wrapper.orderByDesc(HazardRecord::getDiscoveryDate);

        Page<HazardRecord> result = hazardRecordMapper.selectPage(page, wrapper);
        return new PageResult<>(result.getRecords(), result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Transactional(rollbackFor = Exception.class)
    public HazardRecord rectifyHazard(HazardRectifyDTO dto) {
        HazardRecord hazard = hazardRecordMapper.selectById(dto.getHazardId());
        if (hazard == null) {
            throw new BusinessException("隐患记录不存在");
        }
        checkDataPermission(hazard);

        if (!HazardStatusEnum.PENDING.getCode().equals(hazard.getStatus())
                && !HazardStatusEnum.OVERDUE.getCode().equals(hazard.getStatus())
                && !HazardStatusEnum.ESCALATED.getCode().equals(hazard.getStatus())) {
            throw new BusinessException("当前状态不允许整改");
        }

        if (dto.getRectificationDate().isBefore(hazard.getDiscoveryDate())) {
            throw new BusinessException("整改日期不能早于发现日期");
        }

        hazard.setRectificationMeasures(dto.getRectificationMeasures());
        hazard.setRectificationDate(dto.getRectificationDate());
        hazard.setRectifier(dto.getRectifier() != null ? dto.getRectifier() : SecurityUtil.getCurrentRealName());
        hazard.setStatus(HazardStatusEnum.PENDING_REVIEW.getCode());
        hazard.setRemark(dto.getRemark());
        hazardRecordMapper.updateById(hazard);

        return hazard;
    }

    @Transactional(rollbackFor = Exception.class)
    public HazardRecord reviewHazard(HazardReviewDTO dto) {
        HazardRecord hazard = hazardRecordMapper.selectById(dto.getHazardId());
        if (hazard == null) {
            throw new BusinessException("隐患记录不存在");
        }

        if (!HazardStatusEnum.PENDING_REVIEW.getCode().equals(hazard.getStatus())) {
            throw new BusinessException("当前状态不允许复查");
        }

        hazard.setReviewDate(dto.getReviewDate());
        hazard.setReviewer(dto.getReviewer() != null ? dto.getReviewer() : SecurityUtil.getCurrentRealName());

        if (Boolean.TRUE.equals(dto.getPassed())) {
            hazard.setStatus(HazardStatusEnum.CLOSED.getCode());
        } else {
            hazard.setStatus(HazardStatusEnum.PENDING.getCode());
        }
        hazard.setRemark(dto.getRemark());
        hazardRecordMapper.updateById(hazard);

        return hazard;
    }

    @Transactional(rollbackFor = Exception.class)
    public void escalateHazard(Long hazardId) {
        HazardRecord hazard = hazardRecordMapper.selectById(hazardId);
        if (hazard == null) {
            throw new BusinessException("隐患记录不存在");
        }

        hazard.setEscalated(1);
        hazard.setEscalateTime(LocalDateTime.now());
        hazard.setStatus(HazardStatusEnum.ESCALATED.getCode());
        hazardRecordMapper.updateById(hazard);

        Notification notification = new Notification();
        notification.setNotificationType("督办通知");
        notification.setTitle("隐患逾期督办通知");
        notification.setContent(String.format("隐患编号[%s]已逾期未整改，请上级部门督办处理。", hazard.getHazardNo()));
        notification.setReceiverRole(RoleEnum.SUPERVISOR.getCode());
        notification.setReadStatus(0);
        notification.setBizType("HAZARD_ESCALATE");
        notification.setBizId(hazard.getId());
        notificationMapper.insert(notification);
    }

    public List<HazardRecord> getOverdueHazards() {
        return hazardRecordMapper.selectOverdueHazards(LocalDate.now());
    }

    private void checkDataPermission(HazardRecord hazard) {
        if (hazard == null) return;
        String roleCode = SecurityUtil.getCurrentRoleCode();
        if (RoleEnum.USE_UNIT.getCode().equals(roleCode)) {
            Long orgId = SecurityUtil.getCurrentOrganizationId();
            if (orgId != null && !orgId.equals(hazard.getUseUnitId())) {
                throw new BusinessException("无权限访问该隐患数据");
            }
        }
    }
}
