package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.entity.ViolationRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ViolationRecordMapper extends BaseMapper<ViolationRecord> {

    IPage<ViolationRecord> selectPageByCondition(Page<ViolationRecord> page,
                                                  @Param("status") Integer status,
                                                  @Param("violationType") Integer violationType,
                                                  @Param("countyId") Long countyId,
                                                  @Param("stationId") Long stationId,
                                                  @Param("severity") String severity,
                                                  @Param("keyword") String keyword);

    List<ViolationRecord> selectByRetailerId(@Param("retailerId") Long retailerId,
                                              @Param("status") Integer status);

    Integer countViolationsByRetailerAndPeriod(@Param("retailerId") Long retailerId,
                                                @Param("startTime") String startTime,
                                                @Param("endTime") String endTime);

    Integer countViolationsByCountyAndType(@Param("countyId") Long countyId,
                                            @Param("violationType") Integer violationType,
                                            @Param("month") String month);
}
