package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.entity.CreditRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface CreditRecordMapper extends BaseMapper<CreditRecord> {

    CreditRecord selectByRecordNo(@Param("recordNo") String recordNo);

    List<CreditRecord> selectByRetailerId(@Param("retailerId") Long retailerId);

    IPage<CreditRecord> selectPageByCondition(Page<CreditRecord> page,
                                               @Param("retailerId") Long retailerId,
                                               @Param("countyId") Long countyId,
                                               @Param("stationId") Long stationId,
                                               @Param("changeType") String changeType);

    Integer countByRetailerAndType(@Param("retailerId") Long retailerId,
                                    @Param("changeType") String changeType,
                                    @Param("startTime") String startTime,
                                    @Param("endTime") String endTime);
}
