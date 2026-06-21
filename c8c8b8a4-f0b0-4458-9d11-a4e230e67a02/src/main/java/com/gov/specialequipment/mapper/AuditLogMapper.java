package com.gov.specialequipment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.gov.specialequipment.entity.AuditLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AuditLogMapper extends BaseMapper<AuditLog> {
}
