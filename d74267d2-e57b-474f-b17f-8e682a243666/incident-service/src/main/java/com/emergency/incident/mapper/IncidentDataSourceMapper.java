package com.emergency.incident.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.incident.entity.IncidentDataSource;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface IncidentDataSourceMapper extends BaseMapper<IncidentDataSource> {

    @Select("SELECT * FROM incident_data_source WHERE incident_id = #{incidentId} AND deleted = 0 ORDER BY collected_at DESC")
    List<IncidentDataSource> selectByIncidentId(@Param("incidentId") Long incidentId);

    @Select("SELECT * FROM incident_data_source WHERE data_type = #{dataType} AND deleted = 0 ORDER BY collected_at DESC LIMIT 100")
    List<IncidentDataSource> selectByDataType(@Param("dataType") String dataType);
}
