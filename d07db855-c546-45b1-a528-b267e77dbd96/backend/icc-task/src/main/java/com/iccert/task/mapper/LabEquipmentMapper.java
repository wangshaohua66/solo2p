package com.iccert.task.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.iccert.task.entity.LabEquipment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface LabEquipmentMapper extends BaseMapper<LabEquipment> {

    @Select("SELECT * FROM lab_equipment WHERE equipment_status = 'IDLE' AND is_deleted = 0 ORDER BY current_load ASC")
    List<LabEquipment> selectIdleEquipments();

    @Select("SELECT COUNT(*) > 0 FROM equipment_booking WHERE equipment_id = #{equipmentId} " +
            "AND booking_status IN ('CONFIRMED','RUNNING') " +
            "AND book_start_time < #{endTime} AND book_end_time > #{startTime} " +
            "AND is_deleted = 0")
    boolean hasBookingConflict(@Param("equipmentId") Long equipmentId,
                               @Param("startTime") LocalDateTime startTime,
                               @Param("endTime") LocalDateTime endTime);
}
