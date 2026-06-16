package com.emergency.incident.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.incident.entity.IncidentReviewReport;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface IncidentReviewReportMapper extends BaseMapper<IncidentReviewReport> {

    @Select("SELECT * FROM incident_review_report WHERE incident_id = #{incidentId} AND deleted = 0 ORDER BY created_at DESC")
    List<IncidentReviewReport> selectByIncidentId(@Param("incidentId") Long incidentId);

    @Select("SELECT * FROM incident_review_report WHERE archive_id = #{archiveId} AND deleted = 0 ORDER BY created_at DESC")
    List<IncidentReviewReport> selectByArchiveId(@Param("archiveId") Long archiveId);

    @Select("SELECT * FROM incident_review_report WHERE status = #{status} AND deleted = 0 ORDER BY created_at DESC LIMIT #{limit}")
    List<IncidentReviewReport> selectByStatus(@Param("status") Integer status, @Param("limit") Integer limit);
}
