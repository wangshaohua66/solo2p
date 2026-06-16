package com.emergency.auth.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.auth.entity.Approval;
import com.emergency.common.enums.ApprovalStatus;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface ApprovalMapper extends BaseMapper<Approval> {

    @Select("SELECT * FROM sys_approval WHERE business_type = #{businessType} AND business_id = #{businessId} AND deleted = 0 ORDER BY created_at DESC LIMIT 1")
    Approval selectLatestByBusiness(@Param("businessType") String businessType, @Param("businessId") Long businessId);

    @Select("SELECT * FROM sys_approval WHERE current_approver_id = #{approverId} AND status = #{status} AND deleted = 0 ORDER BY created_at DESC")
    List<Approval> selectPendingByApproverId(@Param("approverId") Long approverId, @Param("status") ApprovalStatus status);

    @Update("UPDATE sys_approval SET status = #{status}, approval_opinion = #{opinion}, approved_at = #{approvedAt}, updated_by = #{userId}, updated_at = NOW() WHERE id = #{id}")
    int updateApprovalStatus(@Param("id") Long id, @Param("status") ApprovalStatus status,
                             @Param("opinion") String opinion, @Param("approvedAt") LocalDateTime approvedAt,
                             @Param("userId") Long userId);

    @Select("SELECT * FROM sys_approval WHERE applicant_org_id = #{orgId} AND deleted = 0 ORDER BY created_at DESC LIMIT 100")
    List<Approval> selectByOrgId(@Param("orgId") Long orgId);
}
