package com.emergency.incident.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.incident.entity.IncidentCaseComparison;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface IncidentCaseComparisonMapper extends BaseMapper<IncidentCaseComparison> {

    @Select("SELECT * FROM incident_case_comparison WHERE source_incident_id = #{sourceIncidentId} AND deleted = 0 ORDER BY similarity DESC")
    List<IncidentCaseComparison> selectBySourceIncidentId(@Param("sourceIncidentId") Long sourceIncidentId);

    @Select("SELECT * FROM incident_case_comparison WHERE target_case_id = #{targetCaseId} AND deleted = 0 ORDER BY created_at DESC")
    List<IncidentCaseComparison> selectByTargetCaseId(@Param("targetCaseId") Long targetCaseId);
}
