package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.entity.InspectionTask;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface InspectionTaskMapper extends BaseMapper<InspectionTask> {

    IPage<InspectionTask> selectPageByCondition(Page<InspectionTask> page,
                                                 @Param("status") Integer status,
                                                 @Param("inspectorId") Long inspectorId,
                                                 @Param("countyId") Long countyId,
                                                 @Param("stationId") Long stationId,
                                                 @Param("riskLevel") String riskLevel,
                                                 @Param("hasViolation") Integer hasViolation);

    List<InspectionTask> selectPendingTasksByGridId(@Param("gridId") Long gridId,
                                                     @Param("status") Integer status);

    Integer countMonthlyTasksByInspector(@Param("inspectorId") Long inspectorId,
                                          @Param("month") String month);
}
