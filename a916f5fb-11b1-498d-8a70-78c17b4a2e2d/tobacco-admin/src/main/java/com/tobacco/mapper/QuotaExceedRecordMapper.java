package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tobacco.entity.QuotaExceedRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface QuotaExceedRecordMapper extends BaseMapper<QuotaExceedRecord> {

    @Select("SELECT COUNT(*) FROM quota_exceed_record WHERE retailer_id = #{retailerId} AND order_period = #{orderPeriod}")
    Integer countByRetailerAndPeriod(@Param("retailerId") Long retailerId, @Param("orderPeriod") String orderPeriod);
}
