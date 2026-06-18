package com.iccert.task.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.iccert.task.entity.InspectionTask;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface InspectionTaskMapper extends BaseMapper<InspectionTask> {

    @Select("SELECT * FROM inspection_task WHERE task_status = 'PENDING' AND is_deleted = 0 ORDER BY priority DESC, create_time ASC")
    List<InspectionTask> selectPendingTasks();

    @Select("SELECT * FROM inspection_task WHERE task_status = 'IN_PROGRESS' AND deadline < CURDATE() AND is_overdue_warned = 0")
    List<InspectionTask> selectOverdueTasks();
}
