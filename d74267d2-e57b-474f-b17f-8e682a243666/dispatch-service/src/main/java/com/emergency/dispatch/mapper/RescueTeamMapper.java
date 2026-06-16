package com.emergency.dispatch.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.common.enums.TeamStatus;
import com.emergency.dispatch.entity.RescueTeam;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface RescueTeamMapper extends BaseMapper<RescueTeam> {

    @Select("SELECT * FROM rescue_team WHERE deleted = 0 AND status = #{status} " +
            "AND ST_DWithin(location_point::geography, ST_SetSRID(ST_MakePoint(#{lng}, #{lat}), 4326)::geography, #{radius} * 1000) " +
            "ORDER BY ST_Distance(location_point::geography, ST_SetSRID(ST_MakePoint(#{lng}, #{lat}), 4326)::geography) " +
            "LIMIT #{limit}")
    List<RescueTeam> selectAvailableTeamsNearby(
            @Param("lng") Double lng,
            @Param("lat") Double lat,
            @Param("radius") Double radius,
            @Param("status") TeamStatus status,
            @Param("limit") Integer limit);

    @Select("SELECT * FROM rescue_team WHERE team_code = #{teamCode} AND deleted = 0")
    RescueTeam selectByTeamCode(@Param("teamCode") String teamCode);

    @Update("UPDATE rescue_team SET status = #{status}, current_task_count = current_task_count + #{taskDelta}, updated_by = #{userId}, updated_at = NOW() WHERE id = #{id}")
    int updateStatusAndTaskCount(@Param("id") Long id, @Param("status") TeamStatus status,
                                 @Param("taskDelta") Integer taskDelta, @Param("userId") Long userId);

    @Select("SELECT * FROM rescue_team WHERE deleted = 0 AND organization_id IN (${orgIds}) ORDER BY organization_id, team_type")
    List<RescueTeam> selectByOrgIds(@Param("orgIds") String orgIds);

    @Select("SELECT id FROM rescue_team WHERE status = 1 AND deleted = 0 AND id IN (${teamIds})")
    List<Long> selectAvailableTeamIds(@Param("teamIds") String teamIds);
}
