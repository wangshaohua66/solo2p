package com.design.collaboration.mapper;

import com.design.collaboration.entity.ReviewComment;
import com.design.collaboration.entity.ReviewRecord;
import com.design.collaboration.enums.ReviewStatus;
import org.apache.ibatis.annotations.*;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface ReviewMapper {

    @Select("SELECT r.*, u.name as reviewer_name FROM review_record r " +
            "LEFT JOIN sys_user u ON r.reviewer_id = u.id WHERE r.id = #{id}")
    ReviewRecord findById(Long id);

    @Select("<script>" +
            "SELECT r.*, u.name as reviewer_name FROM review_record r " +
            "LEFT JOIN sys_user u ON r.reviewer_id = u.id " +
            "<where>" +
            "  <if test='projectId != null'>AND r.project_id = #{projectId}</if>" +
            "  <if test='taskId != null'>AND r.task_id = #{taskId}</if>" +
            "  <if test='status != null'>AND r.status = #{status}</if>" +
            "  <if test='reviewerId != null'>AND r.reviewer_id = #{reviewerId}</if>" +
            "</where> ORDER BY r.submitted_at DESC" +
            "</script>")
    List<ReviewRecord> findByConditions(@Param("projectId") Long projectId,
                                         @Param("taskId") Long taskId,
                                         @Param("status") ReviewStatus status,
                                         @Param("reviewerId") Long reviewerId);

    @Insert("INSERT INTO review_record(task_id, project_id, version_id, level, reviewer_id, status) " +
            "VALUES(#{taskId}, #{projectId}, #{versionId}, #{level}, #{reviewerId}, #{status})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(ReviewRecord record);

    @Update("UPDATE review_record SET status=#{status}, completed_at=#{completedAt} WHERE id=#{id}")
    int updateStatus(@Param("id") Long id, @Param("status") ReviewStatus status, @Param("completedAt") LocalDateTime completedAt);

    @Select("SELECT c.*, u.name as created_by_name FROM review_comment c " +
            "LEFT JOIN sys_user u ON c.created_by = u.id " +
            "WHERE c.review_record_id = #{reviewRecordId} ORDER BY c.created_at")
    List<ReviewComment> findCommentsByReviewRecordId(Long reviewRecordId);

    @Insert("INSERT INTO review_comment(review_record_id, content, location, created_by) " +
            "VALUES(#{reviewRecordId}, #{content}, #{location}, #{createdBy})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertComment(ReviewComment comment);

    @Update("UPDATE review_comment SET reply=#{reply}, resolved=#{resolved}, replied_at=CURRENT_TIMESTAMP WHERE id=#{id}")
    int updateComment(@Param("id") Long id, @Param("reply") String reply, @Param("resolved") Boolean resolved);
}
