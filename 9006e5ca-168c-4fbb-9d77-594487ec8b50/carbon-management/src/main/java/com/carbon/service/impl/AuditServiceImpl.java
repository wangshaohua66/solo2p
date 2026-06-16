package com.carbon.service.impl;

import cn.hutool.core.bean.BeanUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.carbon.common.response.PageResult;
import com.carbon.dto.audit.AuditQueryDTO;
import com.carbon.entity.AuditLog;
import com.carbon.mapper.AuditLogMapper;
import com.carbon.service.AuditService;
import com.carbon.vo.audit.AuditLogVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditServiceImpl implements AuditService {

    private final AuditLogMapper auditLogMapper;

    @Async("auditExecutor")
    @Override
    public void log(AuditLog auditLog) {
        try {
            auditLogMapper.insert(auditLog);
        } catch (Exception e) {
            log.error("审计日志写入失败: bizType={}, bizId={}", auditLog.getBizType(), auditLog.getBizId(), e);
        }
    }

    @Override
    public AuditLogVO getById(Long id) {
        AuditLog auditLog = auditLogMapper.selectById(id);
        if (auditLog == null) {
            return null;
        }
        return toVO(auditLog);
    }

    @Override
    public PageResult<AuditLogVO> page(AuditQueryDTO dto) {
        LambdaQueryWrapper<AuditLog> wrapper = new LambdaQueryWrapper<AuditLog>()
                .eq(dto.getEnterpriseId() != null, AuditLog::getEnterpriseId, dto.getEnterpriseId())
                .eq(dto.getEnterpriseCode() != null, AuditLog::getEnterpriseCode, dto.getEnterpriseCode())
                .eq(dto.getBizType() != null, AuditLog::getBizType, dto.getBizType())
                .ge(dto.getStartTime() != null, AuditLog::getCreatedTime, dto.getStartTime())
                .le(dto.getEndTime() != null, AuditLog::getCreatedTime, dto.getEndTime())
                .orderByDesc(AuditLog::getCreatedTime);

        Page<AuditLog> page = auditLogMapper.selectPage(new Page<>(dto.getPage(), dto.getSize()), wrapper);
        return new PageResult<>(page.getTotal(), (int) page.getCurrent(), (int) page.getSize(),
                page.getRecords().stream().map(this::toVO).toList());
    }

    private AuditLogVO toVO(AuditLog auditLog) {
        return BeanUtil.copyProperties(auditLog, AuditLogVO.class);
    }
}
