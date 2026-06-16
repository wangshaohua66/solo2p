package com.emergency.incident.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.incident.entity.IncidentArchive;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface IncidentArchiveMapper extends BaseMapper<IncidentArchive> {

    @Select("SELECT * FROM incident_archive WHERE incident_id = #{incidentId} AND deleted = 0 ORDER BY created_at DESC")
    List<IncidentArchive> selectByIncidentId(@Param("incidentId") Long incidentId);

    @Select("SELECT * FROM incident_archive WHERE archive_status = #{status} AND deleted = 0 ORDER BY created_at DESC")
    List<IncidentArchive> selectByStatus(@Param("status") Integer status);
}
