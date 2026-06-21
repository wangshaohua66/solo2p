package com.gov.specialequipment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.gov.specialequipment.entity.HazardRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Mapper
public interface HazardRecordMapper extends BaseMapper<HazardRecord> {

    @Select("SELECT hazard_level as hazardLevel, COUNT(*) as count FROM hazard_record WHERE deleted = 0 GROUP BY hazard_level")
    List<Map<String, Object>> countByLevel();

    @Select("SELECT status, COUNT(*) as count FROM hazard_record WHERE deleted = 0 GROUP BY status")
    List<Map<String, Object>> countByStatus();

    @Select("SELECT DATE_FORMAT(discovery_date, '%Y-%m') as month, COUNT(*) as count FROM hazard_record WHERE deleted = 0 AND discovery_date BETWEEN #{start} AND #{end} GROUP BY DATE_FORMAT(discovery_date, '%Y-%m') ORDER BY month")
    List<Map<String, Object>> countByMonth(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Select("SELECT * FROM hazard_record WHERE deleted = 0 AND status IN (1, 2) AND deadline < #{today}")
    List<HazardRecord> selectOverdueHazards(@Param("today") LocalDate today);
}
