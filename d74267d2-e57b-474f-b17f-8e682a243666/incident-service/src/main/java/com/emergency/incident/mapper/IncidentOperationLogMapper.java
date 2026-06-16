package com.emergency.incident.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.incident.entity.IncidentOperationLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface IncidentOperationLogMapper extends BaseMapper<IncidentOperationLog> {

    @Select("SELECT * FROM incident_operation_log WHERE incident_id = #{incidentId} AND deleted = 0 ORDER BY operation_time DESC")
    List<IncidentOperationLog> selectByIncidentId(@Param("incidentId") Long incidentId);

    @Select("SELECT * FROM incident_operation_log WHERE incident_id = #{incidentId} AND operation_type = #{operationType} AND deleted = 0 ORDER BY operation_time DESC")
    List<IncidentOperationLog> selectByIncidentIdAndType(@Param("incidentId") Long incidentId, @Param("operationType") String operationType);
}
