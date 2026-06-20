package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.entity.Order;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface OrderMapper extends BaseMapper<Order> {

    @Select("SELECT * FROM tobacco_order WHERE order_no = #{orderNo} AND deleted = 0")
    Order selectByOrderNo(@Param("orderNo") String orderNo);

    IPage<Order> selectPageByCondition(Page<Order> page,
                                        @Param("status") Integer status,
                                        @Param("retailerId") Long retailerId,
                                        @Param("countyId") Long countyId,
                                        @Param("stationId") Long stationId,
                                        @Param("orderPeriod") String orderPeriod,
                                        @Param("keyword") String keyword);

    @Select("SELECT * FROM tobacco_order WHERE order_period = #{orderPeriod} AND status = #{status} AND deleted = 0")
    List<Order> selectByPeriodAndStatus(@Param("orderPeriod") String orderPeriod,
                                         @Param("status") Integer status);

    @Select("SELECT COUNT(*) FROM tobacco_order WHERE retailer_id = #{retailerId} AND order_period = #{orderPeriod} AND deleted = 0 AND status != 5")
    Integer countByRetailerAndPeriod(@Param("retailerId") Long retailerId,
                                      @Param("orderPeriod") String orderPeriod);

    @Select("SELECT COALESCE(SUM(total_quantity), 0) FROM tobacco_order WHERE retailer_id = #{retailerId} AND order_period = #{orderPeriod} AND deleted = 0 AND status != 5")
    Integer sumQuantityByRetailerAndPeriod(@Param("retailerId") Long retailerId,
                                            @Param("orderPeriod") String orderPeriod);

    @Select("SELECT * FROM tobacco_order WHERE order_period = #{orderPeriod} AND status = #{status} AND delivery_status = #{deliveryStatus} AND deleted = 0")
    List<Order> selectForDelivery(@Param("orderPeriod") String orderPeriod,
                                   @Param("status") Integer status,
                                   @Param("deliveryStatus") Integer deliveryStatus);
}
