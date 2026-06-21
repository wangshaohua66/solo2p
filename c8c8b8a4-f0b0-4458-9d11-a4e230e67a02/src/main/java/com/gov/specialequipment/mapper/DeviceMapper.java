package com.gov.specialequipment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.gov.specialequipment.entity.Device;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Mapper
public interface DeviceMapper extends BaseMapper<Device> {

    @Select("SELECT device_type as deviceType, COUNT(*) as count FROM device WHERE deleted = 0 GROUP BY device_type")
    List<Map<String, Object>> countByDeviceType();

    @Select("SELECT status, COUNT(*) as count FROM device WHERE deleted = 0 GROUP BY status")
    List<Map<String, Object>> countByStatus();

    @Select("SELECT region_code as regionCode, region_name as regionName, COUNT(*) as count FROM device WHERE deleted = 0 GROUP BY region_code, region_name")
    List<Map<String, Object>> countByRegion();

    @Select("SELECT * FROM device WHERE deleted = 0 AND status != 4 AND next_inspection_date IS NOT NULL AND next_inspection_date <= #{deadline}")
    List<Device> selectOverdueDevices(@Param("deadline") LocalDate deadline);

    @Select("SELECT * FROM device WHERE deleted = 0 AND status != 4 AND next_inspection_date IS NOT NULL AND next_inspection_date BETWEEN #{start} AND #{end}")
    List<Device> selectWarningDevices(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Select("SELECT device_type as code, COUNT(*) as totalCount, " +
            "SUM(CASE WHEN next_inspection_date > NOW() OR next_inspection_date IS NULL THEN 1 ELSE 0 END) as normalCount, " +
            "SUM(CASE WHEN next_inspection_date <= NOW() THEN 1 ELSE 0 END) as overdueCount " +
            "FROM device WHERE deleted = 0 AND status != 4 " +
            "GROUP BY device_type")
    List<Map<String, Object>> countInspectionCoverageByDeviceType();

    @Select("SELECT region_code as code, region_name as name, COUNT(*) as totalCount, " +
            "SUM(CASE WHEN next_inspection_date > NOW() OR next_inspection_date IS NULL THEN 1 ELSE 0 END) as normalCount, " +
            "SUM(CASE WHEN next_inspection_date <= NOW() THEN 1 ELSE 0 END) as overdueCount " +
            "FROM device WHERE deleted = 0 AND status != 4 " +
            "GROUP BY region_code, region_name " +
            "ORDER BY region_code")
    List<Map<String, Object>> countInspectionCoverageByRegion();
}
