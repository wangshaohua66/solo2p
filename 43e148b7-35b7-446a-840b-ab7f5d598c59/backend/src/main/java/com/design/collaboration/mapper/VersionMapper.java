package com.design.collaboration.mapper;

import com.design.collaboration.entity.DesignVersion;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface VersionMapper {

    @Select("SELECT v.*, p.name as project_name, u.name as uploaded_by_name FROM design_version v " +
            "LEFT JOIN project p ON v.project_id = p.id " +
            "LEFT JOIN sys_user u ON v.uploaded_by = u.id WHERE v.id = #{id}")
    DesignVersion findById(Long id);

    @Select("<script>" +
            "SELECT v.*, p.name as project_name, u.name as uploaded_by_name FROM design_version v " +
            "LEFT JOIN project p ON v.project_id = p.id " +
            "LEFT JOIN sys_user u ON v.uploaded_by = u.id " +
            "<where>" +
            "  <if test='projectId != null'>AND v.project_id = #{projectId}</if>" +
            "  <if test='taskId != null'>AND v.task_id = #{taskId}</if>" +
            "  <if test='onlyReleased != null and onlyReleased == true'>AND v.is_released = 1</if>" +
            "</where> ORDER BY v.created_at DESC" +
            "</script>")
    List<DesignVersion> findByConditions(@Param("projectId") Long projectId,
                                       @Param("taskId") Long taskId,
                                       @Param("onlyReleased") Boolean onlyReleased);

    @Select("SELECT MAX(CAST(SUBSTR(version_no, 2) AS INTEGER)) FROM design_version WHERE project_id = #{projectId} AND task_id = #{taskId}")
    Integer findMaxVersionNumber(@Param("projectId") Long projectId, @Param("taskId") Long taskId);

    @Insert("INSERT INTO design_version(project_id, task_id, version_no, file_name, file_size, " +
            "file_path, uploaded_by, description, is_released) " +
            "VALUES(#{projectId}, #{taskId}, #{versionNo}, #{fileName}, #{fileSize}, " +
            "#{filePath}, #{uploadedBy}, #{description}, #{isReleased})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(DesignVersion version);

    @Update("UPDATE design_version SET is_released=#{isReleased} WHERE id=#{id}")
    int updateReleased(@Param("id") Long id, @Param("isReleased") Boolean isReleased);

    @Delete("DELETE FROM design_version WHERE id=#{id}")
    int deleteById(Long id);
}
