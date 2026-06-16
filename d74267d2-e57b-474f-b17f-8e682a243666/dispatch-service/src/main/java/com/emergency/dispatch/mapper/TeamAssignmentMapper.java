package com.emergency.dispatch.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.dispatch.entity.TeamAssignment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TeamAssignmentMapper extends BaseMapper<TeamAssignment> {

    @Select("SELECT * FROM dispatch_team_assignment WHERE dispatch_plan_id = #{planId} AND deleted = 0 ORDER BY created_at")
    List<TeamAssignment> selectByPlanId(@Param("planId") Long planId);

    @Select("SELECT team_id FROM dispatch_team_assignment WHERE status IN ('ASSIGNED','DEPARTED','ON_SCENE','WORKING') AND deleted = 0 AND team_id IN (${teamIds})")
    List<Long> selectBusyTeamIds(@Param("teamIds") String teamIds);

    @Select("SELECT * FROM dispatch_team_assignment WHERE team_id = #{teamId} AND deleted = 0 ORDER BY created_at DESC LIMIT 10")
    List<TeamAssignment> selectByTeamId(@Param("teamId") Long teamId);
}
