package com.design.collaboration.mapper;

import com.design.collaboration.entity.ChangeApproval;
import com.design.collaboration.entity.ChangeRequest;
import com.design.collaboration.enums.ChangeStatus;
import org.apache.ibatis.annotations.*;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface ChangeMapper {

    @Select("SELECT c.*, p.name as project_name, u.name as applicant_name FROM change_request c " +
            "LEFT JOIN project p ON c.project_id = p.id " +
            "LEFT JOIN sys_user u ON c.applicant_id = u.id WHERE c.id = #{id}")
    ChangeRequest findById(Long id);

    @Select("<script>" +
            "SELECT c.*, p.name as project_name, u.name as applicant_name FROM change_request c " +
            "LEFT JOIN project p ON c.project_id = p.id " +
            "LEFT JOIN sys_user u ON c.applicant_id = u.id " +
            "<where>" +
            "  <if test='projectId != null'>AND c.project_id = #{projectId}</if>" +
            "  <if test='status != null'>AND c.status = #{status}</if>" +
            "  <if test='applicantId != null'>AND c.applicant_id = #{applicantId}</if>" +
            "</where> ORDER BY c.created_at DESC" +
            "</script>")
    List<ChangeRequest> findByConditions(@Param("projectId") Long projectId,
                                         @Param("status") ChangeStatus status,
                                         @Param("applicantId") Long applicantId);

    @Insert("INSERT INTO change_request(project_id, change_no, title, reason, content, impact_scope, " +
            "workload, additional_fee, status, applicant_id, applicant_type, current_approver_id) " +
            "VALUES(#{projectId}, #{changeNo}, #{title}, #{reason}, #{content}, #{impactScope}, " +
            "#{workload}, #{additionalFee}, #{status}, #{applicantId}, #{applicantType}, #{currentApproverId})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(ChangeRequest change);

    @Update("UPDATE change_request SET title=#{title}, reason=#{reason}, content=#{content}, " +
            "impact_scope=#{impactScope}, workload=#{workload}, additional_fee=#{additionalFee}, " +
            "status=#{status}, current_approver_id=#{currentApproverId}, updated_at=CURRENT_TIMESTAMP WHERE id=#{id}")
    int update(ChangeRequest change);

    @Update("UPDATE change_request SET status=#{status}, current_approver_id=#{currentApproverId}, " +
            "updated_at=CURRENT_TIMESTAMP WHERE id=#{id}")
    int updateStatus(@Param("id") Long id, @Param("status") ChangeStatus status, @Param("currentApproverId") Long currentApproverId);

    @Select("SELECT a.*, u.name as approver_name FROM change_approval a " +
            "LEFT JOIN sys_user u ON a.approver_id = u.id " +
            "WHERE a.change_request_id = #{changeRequestId} ORDER BY a.approved_at DESC, a.id")
    List<ChangeApproval> findApprovalsByChangeRequestId(Long changeRequestId);

    @Insert("INSERT INTO change_approval(change_request_id, approver_id, approver_role, " +
            "comment, approved, approved_at) " +
            "VALUES(#{changeRequestId}, #{approverId}, #{approverRole}, #{comment}, #{approved}, #{approvedAt})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertApproval(ChangeApproval approval);
}
