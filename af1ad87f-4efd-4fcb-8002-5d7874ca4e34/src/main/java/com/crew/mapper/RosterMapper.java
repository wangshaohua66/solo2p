package com.crew.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.crew.entity.Roster;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface RosterMapper extends BaseMapper<Roster> {

    @Select("SELECT * FROM roster WHERE crew_id = #{crewId} AND roster_date BETWEEN #{startDate} AND #{endDate} AND deleted = 0")
    List<Roster> findByCrewAndDateRange(@Param("crewId") Long crewId,
                                        @Param("startDate") LocalDate startDate,
                                        @Param("endDate") LocalDate endDate);

    @Select("SELECT * FROM roster WHERE roster_date = #{date} AND deleted = 0")
    List<Roster> findByDate(@Param("date") LocalDate date);

    @Select("SELECT COALESCE(SUM(duty_hours), 0) FROM roster WHERE crew_id = #{crewId} " +
            "AND roster_date BETWEEN #{startDate} AND #{endDate} AND status IN ('APPROVED','ACTIVE') AND deleted = 0")
    Double sumDutyHoursByCrewAndDateRange(@Param("crewId") Long crewId,
                                           @Param("startDate") LocalDate startDate,
                                           @Param("endDate") LocalDate endDate);
}
