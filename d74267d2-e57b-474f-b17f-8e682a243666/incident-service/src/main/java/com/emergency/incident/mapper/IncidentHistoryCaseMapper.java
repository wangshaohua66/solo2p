package com.emergency.incident.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.incident.entity.IncidentHistoryCase;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface IncidentHistoryCaseMapper extends BaseMapper<IncidentHistoryCase> {

    @Select("SELECT * FROM incident_history_case WHERE incident_type = #{incidentType} AND deleted = 0 ORDER BY created_at DESC LIMIT #{limit}")
    List<IncidentHistoryCase> selectByType(@Param("incidentType") Integer incidentType, @Param("limit") Integer limit);

    @Select("SELECT * FROM incident_history_case WHERE is_classic = true AND deleted = 0 ORDER BY created_at DESC")
    List<IncidentHistoryCase> selectClassicCases();

    @Select("SELECT * FROM incident_history_case WHERE incident_type = #{type} AND incident_level = #{level} AND deleted = 0 ORDER BY created_at DESC LIMIT #{limit}")
    List<IncidentHistoryCase> selectSimilarCases(
            @Param("type") Integer type,
            @Param("level") Integer level,
            @Param("limit") Integer limit
    );
}
