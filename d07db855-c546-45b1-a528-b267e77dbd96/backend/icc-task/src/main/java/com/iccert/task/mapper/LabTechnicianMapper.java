package com.iccert.task.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.iccert.task.entity.LabTechnician;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface LabTechnicianMapper extends BaseMapper<LabTechnician> {

    @Select("SELECT t.* FROM lab_technician t WHERE t.status = 'NORMAL' AND t.is_deleted = 0 " +
            "AND EXISTS (SELECT 1 FROM technician_skill s WHERE s.technician_id = t.id " +
            "AND s.skill_name LIKE CONCAT('%', #{skillKeyword}, '%')) " +
            "ORDER BY t.workload ASC")
    List<LabTechnician> selectBySkill(@Param("skillKeyword") String skillKeyword);

    @Select("SELECT * FROM lab_technician WHERE status = 'NORMAL' AND is_deleted = 0 ORDER BY workload ASC")
    List<LabTechnician> selectAvailableTechnicians();
}
