package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tobacco.entity.DeliveryDetail;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DeliveryDetailMapper extends BaseMapper<DeliveryDetail> {

    List<DeliveryDetail> selectByRouteId(@Param("routeId") Long routeId);

    List<DeliveryDetail> selectByPlanId(@Param("planId") Long planId);
}
