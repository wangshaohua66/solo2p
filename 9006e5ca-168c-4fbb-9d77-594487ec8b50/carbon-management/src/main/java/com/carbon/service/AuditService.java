package com.carbon.service;

import com.carbon.common.response.PageResult;
import com.carbon.dto.audit.AuditQueryDTO;
import com.carbon.entity.AuditLog;
import com.carbon.vo.audit.AuditLogVO;

public interface AuditService {

    void log(AuditLog auditLog);

    AuditLogVO getById(Long id);

    PageResult<AuditLogVO> page(AuditQueryDTO dto);
}
