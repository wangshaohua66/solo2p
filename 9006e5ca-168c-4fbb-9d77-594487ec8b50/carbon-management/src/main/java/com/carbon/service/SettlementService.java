package com.carbon.service;

import com.carbon.common.response.PageResult;
import com.carbon.dto.settlement.*;
import com.carbon.vo.settlement.SettlementVO;

public interface SettlementService {

    SettlementVO clear(SettlementClearDTO dto);

    SettlementVO applyInstallment(SettlementInstallmentDTO dto);

    SettlementVO getById(Long id);

    PageResult<SettlementVO> page(SettlementQueryDTO dto);
}
