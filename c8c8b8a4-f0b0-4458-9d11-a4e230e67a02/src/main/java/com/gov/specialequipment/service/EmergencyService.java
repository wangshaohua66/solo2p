package com.gov.specialequipment.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.gov.specialequipment.dto.AccidentReportDTO;
import com.gov.specialequipment.entity.AccidentReport;
import com.gov.specialequipment.entity.Device;
import com.gov.specialequipment.entity.EmergencyResource;
import com.gov.specialequipment.entity.HazardRecord;
import com.gov.specialequipment.entity.InspectionRecord;
import com.gov.specialequipment.entity.Notification;
import com.gov.specialequipment.enums.RoleEnum;
import com.gov.specialequipment.exception.BusinessException;
import com.gov.specialequipment.mapper.AccidentReportMapper;
import com.gov.specialequipment.mapper.DeviceMapper;
import com.gov.specialequipment.mapper.EmergencyResourceMapper;
import com.gov.specialequipment.mapper.HazardRecordMapper;
import com.gov.specialequipment.mapper.InspectionRecordMapper;
import com.gov.specialequipment.mapper.NotificationMapper;
import com.gov.specialequipment.util.SecurityUtil;
import com.gov.specialequipment.vo.EmergencyArchiveVO;
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
public class EmergencyService {

    private final AccidentReportMapper accidentReportMapper;
    private final DeviceMapper deviceMapper;
    private final InspectionRecordMapper inspectionRecordMapper;
    private final HazardRecordMapper hazardRecordMapper;
    private final EmergencyResourceMapper emergencyResourceMapper;
    private final NotificationMapper notificationMapper;

    private final AtomicLong accidentSeq = new AtomicLong(1);

    @Transactional(rollbackFor = Exception.class)
    public AccidentReport reportAccident(AccidentReportDTO dto) {
        Device device = null;
        Long useUnitId = null;
        String useUnitName = "";
        String deviceCode = "";
        Integer deviceType = null;

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

        String accidentNo = "SG" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
                + String.format("%04d", accidentSeq.getAndIncrement() % 10000);

        AccidentReport report = new AccidentReport();
        BeanUtils.copyProperties(dto, report);
        report.setAccidentNo(accidentNo);
        report.setDeviceCode(deviceCode);
        report.setDeviceType(deviceType);
        report.setUseUnitId(useUnitId);
        report.setUseUnitName(useUnitName);
        report.setReportTime(LocalDateTime.now());
        report.setHandlingStatus("待处理");
        accidentReportMapper.insert(report);

        sendEmergencyNotification(report);

        return report;
    }

    private void sendEmergencyNotification(AccidentReport report) {
        Notification notification = new Notification();
        notification.setNotificationType("应急调度");
        notification.setTitle("特种设备事故报告");
        notification.setContent(String.format("接报事故：编号[%s]，请立即启动应急处置预案。", report.getAccidentNo()));
        notification.setReceiverRole(RoleEnum.SUPERVISOR.getCode());
        notification.setReadStatus(0);
        notification.setBizType("ACCIDENT");
        notification.setBizId(report.getId());
        notificationMapper.insert(notification);
    }

    public EmergencyArchiveVO getEmergencyArchive(Long accidentId) {
        AccidentReport accident = accidentReportMapper.selectById(accidentId);
        if (accident == null) {
            throw new BusinessException("事故报告不存在");
        }

        EmergencyArchiveVO vo = new EmergencyArchiveVO();
        vo.setAccidentReport(accident);

        if (accident.getDeviceId() != null) {
            Device device = deviceMapper.selectById(accident.getDeviceId());
            vo.setDevice(device);

            List<InspectionRecord> inspections = inspectionRecordMapper.selectList(
                    new LambdaQueryWrapper<InspectionRecord>()
                            .eq(InspectionRecord::getDeviceId, accident.getDeviceId())
                            .orderByDesc(InspectionRecord::getInspectionDate)
                            .last("LIMIT 5")
            );
            vo.setLatestInspection(inspections);

            List<HazardRecord> hazards = hazardRecordMapper.selectList(
                    new LambdaQueryWrapper<HazardRecord>()
                            .eq(HazardRecord::getDeviceId, accident.getDeviceId())
                            .orderByDesc(HazardRecord::getDiscoveryDate)
                            .last("LIMIT 10")
            );
            vo.setHazards(hazards);

            List<AccidentReport> related = accidentReportMapper.selectList(
                    new LambdaQueryWrapper<AccidentReport>()
                            .eq(AccidentReport::getDeviceType, accident.getDeviceType())
                            .ne(AccidentReport::getId, accident.getId())
                            .orderByDesc(AccidentReport::getAccidentTime)
                            .last("LIMIT 5")
            );
            vo.setRelatedAccidents(related);

            if (device != null && device.getRegionCode() != null) {
                List<EmergencyResource> resources = emergencyResourceMapper.selectByRegion(device.getRegionCode());
                vo.setNearbyResources(resources);
            }
        }

        return vo;
    }

    public Device getDeviceArchive(Long deviceId) {
        Device device = deviceMapper.selectById(deviceId);
        if (device == null) {
            throw new BusinessException("设备不存在");
        }
        return device;
    }

    public List<EmergencyResource> dispatchResources(String regionCode, String resourceType) {
        LambdaQueryWrapper<EmergencyResource> wrapper = new LambdaQueryWrapper<>();
        if (regionCode != null && !regionCode.isEmpty()) {
            wrapper.likeRight(EmergencyResource::getRegionCode, regionCode);
        }
        if (resourceType != null && !resourceType.isEmpty()) {
            wrapper.eq(EmergencyResource::getResourceType, resourceType);
        }
        wrapper.eq(EmergencyResource::getStatus, 1);
        wrapper.orderByAsc(EmergencyResource::getResourceType);
        return emergencyResourceMapper.selectList(wrapper);
    }

    public AccidentReport getAccidentById(Long id) {
        return accidentReportMapper.selectById(id);
    }

    public List<AccidentReport> getAccidentList() {
        return accidentReportMapper.selectList(
                new LambdaQueryWrapper<AccidentReport>()
                        .orderByDesc(AccidentReport::getAccidentTime)
                        .last("LIMIT 100")
        );
    }

    @Transactional(rollbackFor = Exception.class)
    public AccidentReport updateAccidentStatus(Long id, String status, String measures) {
        AccidentReport report = accidentReportMapper.selectById(id);
        if (report == null) {
            throw new BusinessException("事故报告不存在");
        }
        if (status != null) {
            report.setHandlingStatus(status);
        }
        if (measures != null) {
            report.setEmergencyMeasures(measures);
        }
        accidentReportMapper.updateById(report);
        return report;
    }
}
