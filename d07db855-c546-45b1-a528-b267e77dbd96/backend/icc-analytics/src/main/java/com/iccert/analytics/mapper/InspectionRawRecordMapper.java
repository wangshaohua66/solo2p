package com.iccert.analytics.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.iccert.analytics.entity.InspectionRawRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface InspectionRawRecordMapper extends BaseMapper<InspectionRawRecord> {

    @Select("SELECT * FROM inspection_raw_record WHERE task_id = #{taskId} AND is_deleted = 0 ORDER BY id ASC LIMIT 1")
    InspectionRawRecord selectFirstByTask(@Param("taskId") Long taskId);

    @Select("SELECT * FROM inspection_raw_record WHERE task_id = #{taskId} AND is_deleted = 0 ORDER BY id DESC LIMIT 1")
    InspectionRawRecord selectLastByTask(@Param("taskId") Long taskId);
}
