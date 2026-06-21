package com.gov.specialequipment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.gov.specialequipment.entity.InspectionRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Mapper
public interface InspectionRecordMapper extends BaseMapper<InspectionRecord> {

    @Select("SELECT conclusion, COUNT(*) as count FROM inspection_record WHERE deleted = 0 AND inspection_date BETWEEN #{start} AND #{end} GROUP BY conclusion")
    List<Map<String, Object>> countByConclusion(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Select("SELECT DATE_FORMAT(inspection_date, '%Y-%m') as month, COUNT(*) as count FROM inspection_record WHERE deleted = 0 AND inspection_date BETWEEN #{start} AND #{end} GROUP BY DATE_FORMAT(inspection_date, '%Y-%m') ORDER BY month")
    List<Map<String, Object>> countByMonth(@Param("start") LocalDate start, @Param("end") LocalDate end);
}
