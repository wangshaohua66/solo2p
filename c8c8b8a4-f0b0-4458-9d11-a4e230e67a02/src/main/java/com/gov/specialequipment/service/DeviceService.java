package com.gov.specialequipment.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.gov.specialequipment.common.PageResult;
import com.gov.specialequipment.dto.DeviceQueryDTO;
import com.gov.specialequipment.dto.DeviceRegisterDTO;
import com.gov.specialequipment.dto.DeviceStatusChangeDTO;
import com.gov.specialequipment.entity.Device;
import com.gov.specialequipment.entity.DeviceStatusLog;
import com.gov.specialequipment.entity.UseUnit;
import com.gov.specialequipment.enums.DeviceStatusEnum;
import com.gov.specialequipment.enums.DeviceTypeEnum;
import com.gov.specialequipment.enums.RoleEnum;
import com.gov.specialequipment.exception.BusinessException;
import com.gov.specialequipment.mapper.DeviceMapper;
import com.gov.specialequipment.mapper.DeviceStatusLogMapper;
import com.gov.specialequipment.mapper.UseUnitMapper;
import com.gov.specialequipment.util.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceMapper deviceMapper;
    private final DeviceStatusLogMapper deviceStatusLogMapper;
    private final UseUnitMapper useUnitMapper;

    private final AtomicLong deviceCodeSeq = new AtomicLong(1);

    @Transactional(rollbackFor = Exception.class)
    public Device registerDevice(DeviceRegisterDTO dto) {
        validateDeviceParams(dto);

        UseUnit useUnit = useUnitMapper.selectById(dto.getUseUnitId());
        if (useUnit == null) {
            throw new BusinessException("使用单位不存在");
        }

        Device device = new Device();
        BeanUtils.copyProperties(dto, device);
        device.setDeviceCode(generateDeviceCode(dto.getDeviceType()));
        device.setUseUnitName(useUnit.getUnitName());
        device.setStatus(DeviceStatusEnum.NORMAL.getCode());
        device.setRegisterTime(LocalDateTime.now());

        if (dto.getNextInspectionDate() == null && dto.getLastInspectionDate() != null) {
            device.setNextInspectionDate(calculateNextInspectionDate(dto.getDeviceType(), dto.getLastInspectionDate()));
        }

        deviceMapper.insert(device);
        return device;
    }

    private String generateDeviceCode(Integer deviceType) {
        DeviceTypeEnum typeEnum = DeviceTypeEnum.getByCode(deviceType);
        if (typeEnum == null) {
            throw new BusinessException("无效的设备类型");
        }
        String typePrefix = String.format("%02d", deviceType);
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long seq = deviceCodeSeq.getAndIncrement() % 10000;
        return String.format("TS%s%s%04d", typePrefix, datePart, seq);
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

    private void validateDeviceParams(DeviceRegisterDTO dto) {
        DeviceTypeEnum typeEnum = DeviceTypeEnum.getByCode(dto.getDeviceType());
        if (typeEnum == null) {
            throw new BusinessException("无效的设备类型");
        }

        switch (typeEnum) {
            case ELEVATOR:
                if (dto.getRatedSpeed() != null && (dto.getRatedSpeed().compareTo(BigDecimal.ZERO) <= 0
                        || dto.getRatedSpeed().compareTo(new BigDecimal("25")) > 0)) {
                    throw new BusinessException("电梯额定速度应在0-25m/s范围内");
                }
                if (dto.getRatedLoad() != null && dto.getRatedLoad().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessException("电梯额定载荷必须大于0");
                }
                break;
            case CRANE:
                if (dto.getSpan() != null && dto.getSpan().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessException("起重机械跨度必须大于0");
                }
                if (dto.getRatedLoad() != null && dto.getRatedLoad().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessException("起重机械额定载荷必须大于0");
                }
                break;
            case PRESSURE_VESSEL:
            case BOILER:
                if (dto.getWorkingPressure() != null && dto.getWorkingPressure().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessException("工作压力必须大于0");
                }
                if (dto.getVolume() != null && dto.getVolume().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessException("容积必须大于0");
                }
                break;
            case ROPEWAY:
                if (dto.getRopewayLength() != null && dto.getRopewayLength().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessException("索道长度必须大于0");
                }
                break;
            case AMUSEMENT:
                break;
            default:
                break;
        }
    }

    public Device getDeviceById(Long id) {
        Device device = deviceMapper.selectById(id);
        checkDataPermission(device);
        return device;
    }

    public Device getDeviceByCode(String deviceCode) {
        Device device = deviceMapper.selectOne(
                new LambdaQueryWrapper<Device>().eq(Device::getDeviceCode, deviceCode)
        );
        checkDataPermission(device);
        return device;
    }

    public PageResult<Device> queryDevices(DeviceQueryDTO dto) {
        Page<Device> page = new Page<>(dto.getCurrent(), dto.getSize());

        LambdaQueryWrapper<Device> wrapper = new LambdaQueryWrapper<>();

        String roleCode = SecurityUtil.getCurrentRoleCode();
        if (RoleEnum.USE_UNIT.getCode().equals(roleCode)) {
            Long orgId = SecurityUtil.getCurrentOrganizationId();
            if (orgId != null) {
                wrapper.eq(Device::getUseUnitId, orgId);
            }
        }

        if (dto.getDeviceCode() != null && !dto.getDeviceCode().isEmpty()) {
            wrapper.like(Device::getDeviceCode, dto.getDeviceCode());
        }
        if (dto.getDeviceName() != null && !dto.getDeviceName().isEmpty()) {
            wrapper.like(Device::getDeviceName, dto.getDeviceName());
        }
        if (dto.getDeviceType() != null) {
            wrapper.eq(Device::getDeviceType, dto.getDeviceType());
        }
        if (dto.getStatus() != null) {
            wrapper.eq(Device::getStatus, dto.getStatus());
        }
        if (dto.getUseUnitId() != null) {
            wrapper.eq(Device::getUseUnitId, dto.getUseUnitId());
        }
        if (dto.getRegionCode() != null && !dto.getRegionCode().isEmpty()) {
            wrapper.likeRight(Device::getRegionCode, dto.getRegionCode());
        }
        if (dto.getKeyword() != null && !dto.getKeyword().isEmpty()) {
            wrapper.and(w -> w.like(Device::getDeviceCode, dto.getKeyword())
                    .or().like(Device::getDeviceName, dto.getKeyword())
                    .or().like(Device::getInstallationLocation, dto.getKeyword()));
        }

        wrapper.orderByDesc(Device::getCreateTime);

        Page<Device> result = deviceMapper.selectPage(page, wrapper);
        return new PageResult<>(result.getRecords(), result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Transactional(rollbackFor = Exception.class)
    public Device updateDevice(Long id, DeviceRegisterDTO dto) {
        Device existing = deviceMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException("设备不存在");
        }
        checkDataPermission(existing);

        validateDeviceParams(dto);
        BeanUtils.copyProperties(dto, existing, "id", "deviceCode", "status", "registerTime");
        deviceMapper.updateById(existing);
        return existing;
    }

    @Transactional(rollbackFor = Exception.class)
    public void changeDeviceStatus(DeviceStatusChangeDTO dto) {
        Device device = deviceMapper.selectById(dto.getDeviceId());
        if (device == null) {
            throw new BusinessException("设备不存在");
        }
        checkDataPermission(device);

        Integer fromStatus = device.getStatus();
        Integer toStatus = dto.getTargetStatus();

        DeviceStatusEnum targetEnum = null;
        for (DeviceStatusEnum e : DeviceStatusEnum.values()) {
            if (e.getCode().equals(toStatus)) {
                targetEnum = e;
                break;
            }
        }
        if (targetEnum == null) {
            throw new BusinessException("无效的目标状态");
        }

        device.setStatus(toStatus);
        deviceMapper.updateById(device);

        DeviceStatusLog log = new DeviceStatusLog();
        log.setDeviceId(device.getId());
        log.setDeviceCode(device.getDeviceCode());
        log.setFromStatus(fromStatus);
        log.setToStatus(toStatus);
        log.setChangeReason(dto.getChangeReason());
        log.setOperatorName(SecurityUtil.getCurrentRealName());
        log.setOperateTime(LocalDateTime.now());
        log.setRemark(dto.getRemark());
        deviceStatusLogMapper.insert(log);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteDevice(Long id) {
        Device device = deviceMapper.selectById(id);
        if (device == null) {
            throw new BusinessException("设备不存在");
        }
        checkDataPermission(device);
        deviceMapper.deleteById(id);
    }

    private void checkDataPermission(Device device) {
        if (device == null) return;
        String roleCode = SecurityUtil.getCurrentRoleCode();
        if (RoleEnum.USE_UNIT.getCode().equals(roleCode)) {
            Long orgId = SecurityUtil.getCurrentOrganizationId();
            if (orgId != null && !orgId.equals(device.getUseUnitId())) {
                throw new BusinessException("无权限访问该设备数据");
            }
        }
    }

    public java.util.List<Device> getOverdueDevices(LocalDate deadline) {
        return deviceMapper.selectOverdueDevices(deadline);
    }

    public java.util.List<Device> getWarningDevices(LocalDate start, LocalDate end) {
        return deviceMapper.selectWarningDevices(start, end);
    }
}
