package com.iccert.customer.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.iccert.customer.entity.PaymentRecord;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface PaymentRecordMapper extends BaseMapper<PaymentRecord> {
}
