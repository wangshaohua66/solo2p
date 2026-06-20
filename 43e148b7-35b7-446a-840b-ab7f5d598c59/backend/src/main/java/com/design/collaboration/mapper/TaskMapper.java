package com.design.collaboration.mapper;

import com.design.collaboration.entity.DesignTask;
import com.design.collaboration.enums.ProfessionType;
import com.design.collaboration.enums.TaskStatus;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface TaskMapper {

    @Select("SELECT t.*, p.name as project_name, u.name as assignee_name FROM design_task t " +
            "LEFT JOIN project p ON t.project_id = p.id " +
            "LEFT JOIN sys_user u ON t.assignee_id = u.id WHERE t.id = #{id}")
    DesignTask findById(Long id);

    @Select("<script>" +
            "SELECT t.*, p.name as project_name, u.name as assignee_name FROM design_task t " +
            "LEFT JOIN project p ON t.project_id = p.id " +
            "LEFT JOIN sys_user u ON t.assignee_id = u.id " +
            "<where>" +
            "  <if test='projectId != null'>AND t.project_id = #{projectId}</if>" +
            "  <if test='profession != null'>AND t.profession = #{profession}</if>" +
            "  <if test='status != null'>AND t.status = #{status}</if>" +
            "  <if test='assigneeId != null'>AND t.assignee_id = #{assigneeId}</if>" +
            "</where> ORDER BY t.created_at DESC" +
            "</script>")
    List<DesignTask> findByConditions(@Param("projectId") Long projectId,
                                     @Param("profession") ProfessionType profession,
                                     @Param("status") TaskStatus status,
                                     @Param("assigneeId") Long assigneeId);

    @Insert("INSERT INTO design_task(project_id, stage, profession, name, description, parent_id, " +
            "assignee_id, status, progress, planned_start_date, planned_end_date, deliverables) " +
            "VALUES(#{projectId}, #{stage}, #{profession}, #{name}, #{description}, #{parentId}, " +
            "#{assigneeId}, #{status}, #{progress}, #{plannedStartDate}, #{plannedEndDate}, #{deliverables})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(DesignTask task);

    @Update("UPDATE design_task SET name=#{name}, description=#{description}, stage=#{stage}, " +
            "profession=#{profession}, assignee_id=#{assigneeId}, status=#{status}, progress=#{progress}, " +
            "planned_start_date=#{plannedStartDate}, planned_end_date=#{plannedEndDate}, " +
            "actual_start_date=#{actualStartDate}, actual_end_date=#{actualEndDate}, " +
            "deliverables=#{deliverables}, updated_at=CURRENT_TIMESTAMP WHERE id=#{id}")
    int update(DesignTask task);

    @Update("UPDATE design_task SET status=#{status}, progress=#{progress}, updated_at=CURRENT_TIMESTAMP WHERE id=#{id}")
    int updateStatusAndProgress(@Param("id") Long id, @Param("status") TaskStatus status, @Param("progress") Integer progress);

    @Update("UPDATE design_task SET assignee_id=#{assigneeId}, status='IN_PROGRESS', actual_start_date=CURRENT_DATE, " +
            "updated_at=CURRENT_TIMESTAMP WHERE id=#{id}")
    int assignTask(@Param("id") Long id, @Param("assigneeId") Long assigneeId);

    @Delete("DELETE FROM design_task WHERE id=#{id}")
    int deleteById(Long id);

    @Select("SELECT AVG(progress) FROM design_task WHERE project_id = #{projectId} AND profession = #{profession}")
    Integer calculateProgressByProjectAndProfession(@Param("projectId") Long projectId, @Param("profession") ProfessionType profession);
}
