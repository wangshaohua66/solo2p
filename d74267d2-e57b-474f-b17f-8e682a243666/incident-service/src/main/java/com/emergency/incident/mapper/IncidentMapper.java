package com.emergency.incident.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.emergency.common.dto.GeoPoint;
import com.emergency.common.enums.IncidentLevel;
import com.emergency.common.enums.IncidentStatus;
import com.emergency.common.enums.IncidentType;
import com.emergency.incident.entity.Incident;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface IncidentMapper extends BaseMapper<Incident> {

    @Select("SELECT * FROM incident_event WHERE incident_no = #{incidentNo} AND deleted = 0")
    Incident selectByIncidentNo(@Param("incidentNo") String incidentNo);

    @Select("<script>" +
            "SELECT * FROM incident_event " +
            "WHERE deleted = 0 " +
            "<if test='type != null'>AND type = #{type}</if>" +
            "<if test='level != null'>AND level = #{level}</if>" +
            "<if test='status != null'>AND status = #{status}</if>" +
            "<if test='regionCode != null'>AND region_code LIKE CONCAT(#{regionCode}, '%')</if>" +
            "<if test='organizationId != null'>AND organization_id = #{organizationId}</if>" +
            "<if test='startTime != null'>AND occurred_at &gt;= #{startTime}</if>" +
            "<if test='endTime != null'>AND occurred_at &lt;= #{endTime}</if>" +
            "ORDER BY created_at DESC" +
            "</script>")
    IPage<Incident> selectIncidentPage(IPage<Incident> page,
                                      @Param("type") IncidentType type,
                                      @Param("level") IncidentLevel level,
                                      @Param("status") IncidentStatus status,
                                      @Param("regionCode") String regionCode,
                                      @Param("organizationId") Long organizationId,
                                      @Param("startTime") LocalDateTime startTime,
                                      @Param("endTime") LocalDateTime endTime);

    @Select("SELECT * FROM incident_event " +
            "WHERE deleted = 0 AND status IN (1, 2, 3, 4) " +
            "AND ST_DWithin(location_point::geography, ST_SetSRID(ST_MakePoint(#{lng}, #{lat}), 4326)::geography, #{radius} * 1000) " +
            "ORDER BY created_at DESC LIMIT 100")
    List<Incident> selectNearbyIncidents(@Param("lng") Double lng,
                                         @Param("lat") Double lat,
                                         @Param("radius") Double radius);

    @Select("SELECT * FROM incident_event WHERE deleted = 0 AND status IN (1, 2, 3, 4) ORDER BY created_at DESC LIMIT 100")
    List<Incident> selectActiveIncidents();

    @Update("UPDATE incident_event SET status = #{status}, updated_by = #{userId}, updated_at = NOW() WHERE id = #{id}")
    int updateStatus(@Param("id") Long id, @Param("status") IncidentStatus status, @Param("userId") Long userId);

    @Update("UPDATE incident_event SET level = #{level}, updated_by = #{userId}, updated_at = NOW() WHERE id = #{id}")
    int updateLevel(@Param("id") Long id, @Param("level") IncidentLevel level, @Param("userId") Long userId);

    @Select("SELECT COUNT(*) FROM incident_event WHERE deleted = 0 AND status = #{status} " +
            "AND organization_id IN (${orgIds})")
    long countByStatusAndOrgIds(@Param("status") IncidentStatus status, @Param("orgIds") String orgIds);
}
