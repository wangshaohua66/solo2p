package com.emergency.auth.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.auth.entity.ApprovalLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ApprovalLogMapper extends BaseMapper<ApprovalLog> {

    @Select("SELECT * FROM sys_approval_log WHERE approval_id = #{approvalId} AND deleted = 0 ORDER BY approval_level, action_time")
    List<ApprovalLog> selectByApprovalId(@Param("approvalId") Long approvalId);
}
