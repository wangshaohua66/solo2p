package com.crew.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.crew.entity.Qualification;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface QualificationMapper extends BaseMapper<Qualification> {

    @Select("SELECT * FROM qualification WHERE crew_id = #{crewId} AND deleted = 0")
    List<Qualification> findByCrewId(@Param("crewId") Long crewId);

    @Select("SELECT * FROM qualification WHERE expiry_date BETWEEN #{today} AND #{warningDate} AND status = 'VALID' AND deleted = 0")
    List<Qualification> findExpiringBefore(@Param("today") LocalDate today, @Param("warningDate") LocalDate warningDate);

    @Select("SELECT * FROM qualification WHERE expiry_date < #{today} AND status != 'EXPIRED' AND deleted = 0")
    List<Qualification> findExpired(@Param("today") LocalDate today);

    @Select("SELECT * FROM qualification WHERE crew_id = #{crewId} AND qual_type = #{qualType} AND status = 'VALID' AND deleted = 0")
    List<Qualification> findValidByCrewAndType(@Param("crewId") Long crewId, @Param("qualType") String qualType);

    @Select("SELECT * FROM qualification WHERE crew_id = #{crewId} AND aircraft_type = #{aircraftType} AND qual_type = 'TYPE_RATING' AND status = 'VALID' AND deleted = 0")
    List<Qualification> findTypeRating(@Param("crewId") Long crewId, @Param("aircraftType") String aircraftType);
}
