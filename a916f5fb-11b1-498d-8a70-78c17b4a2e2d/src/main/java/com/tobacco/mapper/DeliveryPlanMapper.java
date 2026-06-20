package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.entity.DeliveryPlan;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DeliveryPlanMapper extends BaseMapper<DeliveryPlan> {

    DeliveryPlan selectByPlanNo(@Param("planNo") String planNo);

    IPage<DeliveryPlan> selectPageByCondition(Page<DeliveryPlan> page,
                                               @Param("status") Integer status,
                                               @Param("orderPeriod") String orderPeriod,
                                               @Param("countyId") Long countyId);

    List<DeliveryPlan> selectByPeriod(@Param("orderPeriod") String orderPeriod);
}
