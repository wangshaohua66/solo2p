package com.crew.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.crew.entity.DutyRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface DutyRecordMapper extends BaseMapper<DutyRecord> {

    @Select("SELECT * FROM duty_record WHERE crew_id = #{crewId} AND check_in_time BETWEEN #{startTime} AND #{endTime} AND deleted = 0 ORDER BY check_in_time DESC")
    List<DutyRecord> findByCrewAndTimeRange(@Param("crewId") Long crewId,
                                             @Param("startTime") LocalDateTime startTime,
                                             @Param("endTime") LocalDateTime endTime);

    @Select("SELECT COALESCE(SUM(actual_duty_hours), 0) FROM duty_record WHERE crew_id = #{crewId} " +
            "AND check_in_time BETWEEN #{startTime} AND #{endTime} AND deleted = 0")
    Double sumActualHoursByCrewAndTimeRange(@Param("crewId") Long crewId,
                                             @Param("startTime") LocalDateTime startTime,
                                             @Param("endTime") LocalDateTime endTime);

    @Select("SELECT * FROM duty_record WHERE status = 'ACTIVE' AND deleted = 0")
    List<DutyRecord> findActiveDuties();
}
