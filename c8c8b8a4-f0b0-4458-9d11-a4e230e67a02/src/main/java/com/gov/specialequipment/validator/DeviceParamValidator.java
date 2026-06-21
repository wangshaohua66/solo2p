package com.gov.specialequipment.validator;

import com.gov.specialequipment.enums.DeviceTypeEnum;
import com.gov.specialequipment.exception.BusinessException;

import java.math.BigDecimal;

public class DeviceParamValidator {

    private DeviceParamValidator() {
    }

    public static void validateElevator(BigDecimal ratedSpeed, BigDecimal ratedLoad) {
        if (ratedSpeed != null && (ratedSpeed.compareTo(BigDecimal.ZERO) <= 0
                || ratedSpeed.compareTo(new BigDecimal("25")) > 0)) {
            throw new BusinessException("电梯额定速度应在0.1-25m/s范围内");
        }
        if (ratedLoad != null && ratedLoad.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("电梯额定载荷必须大于0");
        }
        if (ratedLoad != null && ratedLoad.compareTo(new BigDecimal("5000")) > 0) {
            throw new BusinessException("电梯额定载荷不应超过5000kg");
        }
    }

    public static void validateCrane(BigDecimal span, BigDecimal ratedLoad) {
        if (span != null && (span.compareTo(BigDecimal.ZERO) <= 0 || span.compareTo(new BigDecimal("100")) > 0)) {
            throw new BusinessException("起重机械跨度应在0-100m范围内");
        }
        if (ratedLoad != null && (ratedLoad.compareTo(BigDecimal.ZERO) <= 0
                || ratedLoad.compareTo(new BigDecimal("500")) > 0)) {
            throw new BusinessException("起重机械额定载荷应在0-500t范围内");
        }
    }

    public static void validatePressureVessel(BigDecimal workingPressure, BigDecimal volume) {
        if (workingPressure != null && (workingPressure.compareTo(BigDecimal.ZERO) <= 0
                || workingPressure.compareTo(new BigDecimal("100")) > 0)) {
            throw new BusinessException("压力容器工作压力应在0-100MPa范围内");
        }
        if (volume != null && (volume.compareTo(BigDecimal.ZERO) <= 0
                || volume.compareTo(new BigDecimal("1000")) > 0)) {
            throw new BusinessException("压力容器容积应在0-1000m³范围内");
        }
    }

    public static void validateBoiler(BigDecimal workingPressure, BigDecimal volume) {
        if (workingPressure != null && (workingPressure.compareTo(BigDecimal.ZERO) <= 0
                || workingPressure.compareTo(new BigDecimal("20")) > 0)) {
            throw new BusinessException("锅炉工作压力应在0-20MPa范围内");
        }
        if (volume != null && volume.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("锅炉容积必须大于0");
        }
    }

    public static void validateRopeway(BigDecimal ropewayLength) {
        if (ropewayLength != null && (ropewayLength.compareTo(BigDecimal.ZERO) <= 0
                || ropewayLength.compareTo(new BigDecimal("100")) > 0)) {
            throw new BusinessException("客运索道长度应在0-100km范围内");
        }
    }

    public static void validate(Integer deviceType, BigDecimal ratedSpeed, BigDecimal ratedLoad,
                                BigDecimal span, BigDecimal volume, BigDecimal workingPressure,
                                BigDecimal ropewayLength) {
        DeviceTypeEnum typeEnum = DeviceTypeEnum.getByCode(deviceType);
        if (typeEnum == null) {
            throw new BusinessException("无效的设备类型");
        }
        switch (typeEnum) {
            case ELEVATOR -> validateElevator(ratedSpeed, ratedLoad);
            case CRANE -> validateCrane(span, ratedLoad);
            case PRESSURE_VESSEL -> validatePressureVessel(workingPressure, volume);
            case BOILER -> validateBoiler(workingPressure, volume);
            case ROPEWAY -> validateRopeway(ropewayLength);
            case AMUSEMENT -> {
            }
            default -> throw new BusinessException("未支持的设备类型");
        }
    }
}
