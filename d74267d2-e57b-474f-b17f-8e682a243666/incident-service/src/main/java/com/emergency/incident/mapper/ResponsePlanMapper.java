package com.emergency.incident.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.common.enums.IncidentLevel;
import com.emergency.common.enums.IncidentType;
import com.emergency.incident.entity.ResponsePlan;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ResponsePlanMapper extends BaseMapper<ResponsePlan> {

    @Select("SELECT * FROM incident_response_plan WHERE plan_code = #{planCode} AND deleted = 0")
    ResponsePlan selectByPlanCode(@Param("planCode") String planCode);

    @Select("SELECT * FROM incident_response_plan " +
            "WHERE incident_type = #{type} AND status = 1 AND deleted = 0 " +
            "AND min_level &lt;= #{level} AND max_level &gt;= #{level} " +
            "ORDER BY priority DESC LIMIT 1")
    ResponsePlan selectMatchingPlan(@Param("type") IncidentType type, @Param("level") IncidentLevel level);

    @Select("SELECT * FROM incident_response_plan WHERE incident_type = #{type} AND status = 1 AND deleted = 0 ORDER BY priority DESC")
    List<ResponsePlan> selectByType(@Param("type") IncidentType type);
}
