package com.emergency.dispatch.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.dispatch.entity.DispatchPlan;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface DispatchPlanMapper extends BaseMapper<DispatchPlan> {

    @Select("SELECT * FROM dispatch_plan WHERE incident_id = #{incidentId} AND deleted = 0 ORDER BY created_at DESC")
    List<DispatchPlan> selectByIncidentId(@Param("incidentId") Long incidentId);

    @Select("SELECT * FROM dispatch_plan WHERE dispatch_no = #{dispatchNo} AND deleted = 0")
    DispatchPlan selectByDispatchNo(@Param("dispatchNo") String dispatchNo);

    @Update("UPDATE dispatch_plan SET status = #{status}, updated_by = #{userId}, updated_at = NOW() WHERE id = #{id}")
    int updateStatus(@Param("id") Long id, @Param("status") Integer status, @Param("userId") Long userId);

    @Select("SELECT * FROM dispatch_plan WHERE status IN (1, 2, 3, 4) AND deleted = 0 ORDER BY priority, created_at DESC LIMIT 100")
    List<DispatchPlan> selectActivePlans();
}
