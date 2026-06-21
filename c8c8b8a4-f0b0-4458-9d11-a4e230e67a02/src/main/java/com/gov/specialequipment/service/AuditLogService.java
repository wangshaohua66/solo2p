package com.gov.specialequipment.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.gov.specialequipment.common.PageQuery;
import com.gov.specialequipment.common.PageResult;
import com.gov.specialequipment.entity.AuditLog;
import com.gov.specialequipment.mapper.AuditLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogMapper auditLogMapper;

    public PageResult<AuditLog> queryLogs(String module, String operationType, Long operatorId,
                                          LocalDateTime startTime, LocalDateTime endTime, PageQuery pageQuery) {
        Page<AuditLog> page = new Page<>(pageQuery.getCurrent(), pageQuery.getSize());
        LambdaQueryWrapper<AuditLog> wrapper = new LambdaQueryWrapper<>();

        if (module != null && !module.isEmpty()) {
            wrapper.like(AuditLog::getOperationModule, module);
        }
        if (operationType != null && !operationType.isEmpty()) {
            wrapper.eq(AuditLog::getOperationType, operationType);
        }
        if (operatorId != null) {
            wrapper.eq(AuditLog::getOperatorId, operatorId);
        }
        if (startTime != null) {
            wrapper.ge(AuditLog::getOperateTime, startTime);
        }
        if (endTime != null) {
            wrapper.le(AuditLog::getOperateTime, endTime);
        }
        wrapper.orderByDesc(AuditLog::getOperateTime);

        Page<AuditLog> result = auditLogMapper.selectPage(page, wrapper);
        return new PageResult<>(result.getRecords(), result.getTotal(), result.getCurrent(), result.getSize());
    }
}
