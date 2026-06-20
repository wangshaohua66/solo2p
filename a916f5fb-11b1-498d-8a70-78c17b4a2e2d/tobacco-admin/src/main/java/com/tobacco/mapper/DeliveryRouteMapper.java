package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tobacco.entity.DeliveryRoute;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DeliveryRouteMapper extends BaseMapper<DeliveryRoute> {

    List<DeliveryRoute> selectByPlanId(@Param("planId") Long planId);

    DeliveryRoute selectByRouteNo(@Param("routeNo") String routeNo);
}
