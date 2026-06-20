package com.design.collaboration.mapper;

import com.design.collaboration.entity.Project;
import com.design.collaboration.entity.ProjectProfessional;
import com.design.collaboration.entity.ProjectLog;
import com.design.collaboration.enums.ProjectStage;
import com.design.collaboration.enums.ProjectStatus;
import com.design.collaboration.enums.ProjectType;
import org.apache.ibatis.annotations.*;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface ProjectMapper {

    @Select("SELECT p.*, u.name as project_manager_name FROM project p " +
            "LEFT JOIN sys_user u ON p.project_manager_id = u.id WHERE p.id = #{id}")
    Project findById(Long id);

    @Select("<script>" +
            "SELECT p.*, u.name as project_manager_name FROM project p " +
            "LEFT JOIN sys_user u ON p.project_manager_id = u.id " +
            "<where>" +
            "  <if test='keyword != null and keyword != ""'>" +
            "    AND (p.name LIKE CONCAT('%', #{keyword}, '%') OR p.project_no LIKE CONCAT('%', #{keyword}, '%') OR p.client_name LIKE CONCAT('%', #{keyword}, '%'))" +
            "  </if>" +
            "  <if test='type != null'>AND p.type = #{type}</if>" +
            "  <if test='status != null'>AND p.status = #{status}</if>" +
            "  <if test='startDate != null'>AND p.start_date >= #{startDate}</if>" +
            "  <if test='endDate != null'>AND p.end_date &lt;= #{endDate}</if>" +
            "</where> ORDER BY p.created_at DESC" +
            "</script>")
    List<Project> findByConditions(@Param("keyword") String keyword,
                                 @Param("type") ProjectType type,
                                 @Param("status") ProjectStatus status,
                                 @Param("startDate") LocalDate startDate,
                                 @Param("endDate") LocalDate endDate);

    @Select("SELECT COUNT(*) FROM project")
    long countAll();

    @Select("SELECT COUNT(*) FROM project WHERE status = #{status}")
    long countByStatus(ProjectStatus status);

    @Select("SELECT pp.*, u.name as professional_lead_name FROM project_professional pp " +
            "LEFT JOIN sys_user u ON pp.professional_lead_id = u.id " +
            "WHERE pp.project_id = #{projectId}")
    List<ProjectProfessional> findProfessionalsByProjectId(Long projectId);

    @Insert("INSERT INTO project(project_no, name, type, stage, status, contract_amount, start_date, end_date, " +
            "client_name, client_contact, client_phone, project_manager_id, description, progress) " +
            "VALUES(#{projectNo}, #{name}, #{type}, #{stage}, #{status}, #{contractAmount}, #{startDate}, #{endDate}, " +
            "#{clientName}, #{clientContact}, #{clientPhone}, #{projectManagerId}, #{description}, #{progress})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Project project);

    @Update("UPDATE project SET name=#{name}, type=#{type}, stage=#{stage}, status=#{status}, " +
            "contract_amount=#{contractAmount}, start_date=#{startDate}, end_date=#{endDate}, " +
            "client_name=#{clientName}, client_contact=#{clientContact}, client_phone=#{clientPhone}, " +
            "project_manager_id=#{projectManagerId}, description=#{description}, progress=#{progress}, " +
            "updated_at=CURRENT_TIMESTAMP WHERE id=#{id}")
    int update(Project project);

    @Update("UPDATE project SET progress=#{progress}, updated_at=CURRENT_TIMESTAMP WHERE id=#{id}")
    int updateProgress(@Param("id") Long id, @Param("progress") Integer progress);

    @Delete("DELETE FROM project WHERE id=#{id}")
    int deleteById(Long id);

    @Insert("INSERT INTO project_professional(project_id, profession, professional_lead_id, progress) " +
            "VALUES(#{projectId}, #{profession}, #{professionalLeadId}, #{progress})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertProfessional(ProjectProfessional pp);

    @Update("UPDATE project_professional SET professional_lead_id=#{professionalLeadId}, progress=#{progress}, " +
            "updated_at=CURRENT_TIMESTAMP WHERE id=#{id}")
    int updateProfessional(ProjectProfessional pp);

    @Insert("INSERT INTO project_log(project_id, action, content, operator_id, operator_name) " +
            "VALUES(#{projectId}, #{action}, #{content}, #{operatorId}, #{operatorName})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertLog(ProjectLog log);

    @Select("SELECT * FROM project_log WHERE project_id = #{projectId} ORDER BY created_at DESC LIMIT 50")
    List<ProjectLog> findLogsByProjectId(Long projectId);
}
