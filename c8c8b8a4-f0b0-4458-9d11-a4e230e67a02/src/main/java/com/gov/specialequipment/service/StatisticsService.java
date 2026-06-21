package com.gov.specialequipment.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.gov.specialequipment.entity.Device;
import com.gov.specialequipment.entity.HazardRecord;
import com.gov.specialequipment.entity.InspectionRecord;
import com.gov.specialequipment.enums.DeviceStatusEnum;
import com.gov.specialequipment.enums.HazardStatusEnum;
import com.gov.specialequipment.mapper.DeviceMapper;
import com.gov.specialequipment.mapper.HazardRecordMapper;
import com.gov.specialequipment.mapper.InspectionRecordMapper;
import com.gov.specialequipment.vo.StatisticsVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StatisticsService {

    private final DeviceMapper deviceMapper;
    private final InspectionRecordMapper inspectionRecordMapper;
    private final HazardRecordMapper hazardRecordMapper;

    public StatisticsVO getOverviewStatistics() {
        StatisticsVO vo = new StatisticsVO();

        Long totalDevices = deviceMapper.selectCount(
                new LambdaQueryWrapper<Device>().ne(Device::getStatus, 4)
        );
        vo.setTotalDevices(totalDevices);

        Long normalDevices = deviceMapper.selectCount(
                new LambdaQueryWrapper<Device>().eq(Device::getStatus, DeviceStatusEnum.NORMAL.getCode())
        );
        vo.setNormalDevices(normalDevices);

        LocalDate today = LocalDate.now();
        Long overdueDevices = (long) deviceMapper.selectOverdueDevices(today).size();
        vo.setOverdueDevices(overdueDevices);

        Long stoppedDevices = deviceMapper.selectCount(
                new LambdaQueryWrapper<Device>().eq(Device::getStatus, DeviceStatusEnum.STOPPED.getCode())
        );
        vo.setStoppedDevices(stoppedDevices);

        vo.setDeviceTypeDistribution(deviceMapper.countByDeviceType());
        vo.setDeviceStatusDistribution(deviceMapper.countByStatus());
        vo.setDeviceRegionDistribution(deviceMapper.countByRegion());

        if (totalDevices > 0) {
            double rate = (totalDevices - overdueDevices) * 100.0 / totalDevices;
            vo.setInspectionRate(Math.round(rate * 100) / 100.0);
        } else {
            vo.setInspectionRate(0.0);
        }

        LocalDate yearStart = today.withDayOfYear(1);
        LocalDate yearEnd = today;
        vo.setInspectionConclusionDistribution(inspectionRecordMapper.countByConclusion(yearStart, yearEnd));
        vo.setInspectionMonthlyTrend(inspectionRecordMapper.countByMonth(yearStart, yearEnd));

        Long totalHazards = hazardRecordMapper.selectCount(new LambdaQueryWrapper<>());
        vo.setTotalHazards(totalHazards);

        Long pendingHazards = hazardRecordMapper.selectCount(
                new LambdaQueryWrapper<HazardRecord>().in(HazardRecord::getStatus,
                        HazardStatusEnum.PENDING.getCode(), HazardStatusEnum.RECTIFYING.getCode())
        );
        vo.setPendingHazards(pendingHazards);

        Long overdueHazards = (long) hazardRecordMapper.selectOverdueHazards(today).size();
        vo.setOverdueHazards(overdueHazards);

        Long closedHazards = hazardRecordMapper.selectCount(
                new LambdaQueryWrapper<HazardRecord>().eq(HazardRecord::getStatus, HazardStatusEnum.CLOSED.getCode())
        );
        vo.setClosedHazards(closedHazards);

        vo.setHazardLevelDistribution(hazardRecordMapper.countByLevel());
        vo.setHazardStatusDistribution(hazardRecordMapper.countByStatus());
        vo.setHazardMonthlyTrend(hazardRecordMapper.countByMonth(yearStart, yearEnd));

        return vo;
    }

    public List<Map<String, Object>> getDeviceTypeStatistics() {
        return deviceMapper.countByDeviceType();
    }

    public List<Map<String, Object>> getDeviceStatusStatistics() {
        return deviceMapper.countByStatus();
    }

    public List<Map<String, Object>> getDeviceRegionStatistics() {
        return deviceMapper.countByRegion();
    }

    public List<Map<String, Object>> getInspectionConclusionStatistics(LocalDate start, LocalDate end) {
        LocalDate s = start != null ? start : LocalDate.now().withDayOfYear(1);
        LocalDate e = end != null ? end : LocalDate.now();
        return inspectionRecordMapper.countByConclusion(s, e);
    }

    public List<Map<String, Object>> getInspectionTrendStatistics(LocalDate start, LocalDate end) {
        LocalDate s = start != null ? start : LocalDate.now().withDayOfYear(1);
        LocalDate e = end != null ? end : LocalDate.now();
        return inspectionRecordMapper.countByMonth(s, e);
    }

    public List<Map<String, Object>> getHazardLevelStatistics() {
        return hazardRecordMapper.countByLevel();
    }

    public List<Map<String, Object>> getHazardStatusStatistics() {
        return hazardRecordMapper.countByStatus();
    }

    public List<Map<String, Object>> getHazardTrendStatistics(LocalDate start, LocalDate end) {
        LocalDate s = start != null ? start : LocalDate.now().withDayOfYear(1);
        LocalDate e = end != null ? end : LocalDate.now();
        return hazardRecordMapper.countByMonth(s, e);
    }

    public List<Device> getOverdueDeviceList() {
        return deviceMapper.selectOverdueDevices(LocalDate.now());
    }

    public List<HazardRecord> getOverdueHazardList() {
        return hazardRecordMapper.selectOverdueHazards(LocalDate.now());
    }
}
