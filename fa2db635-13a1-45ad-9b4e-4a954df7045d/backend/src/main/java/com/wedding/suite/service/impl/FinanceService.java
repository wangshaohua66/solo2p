package com.wedding.suite.service.impl;

import com.wedding.suite.dto.response.MonthlyStatVO;
import com.wedding.suite.dto.response.OverdueItemVO;
import com.wedding.suite.entity.FinanceEntity;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.FinanceRepository;
import com.wedding.suite.repository.ReceivablePayableRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class FinanceService {

    private final FinanceRepository financeRepo;
    private final ReceivablePayableRepository rpRepo;

    public FinanceService(FinanceRepository financeRepo, ReceivablePayableRepository rpRepo) {
        this.financeRepo = financeRepo;
        this.rpRepo = rpRepo;
    }

    public FinanceEntity wedding(Long weddingId) {
        return financeRepo.findByWeddingId(weddingId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "财务数据不存在"));
    }

    public List<MonthlyStatVO> monthly(Long storeId) {
        return financeRepo.findAll().stream()
                .map(f -> new MonthlyStatVO(f.getCoupleName(), f.getIncome(), f.getCost(), f.getProfit(), 1))
                .collect(Collectors.toList());
    }

    public List<OverdueItemVO> overdue() {
        return rpRepo.findBySettledFalse().stream()
                .filter(r -> r.getDaysOverdue() != null && r.getDaysOverdue() > 0)
                .map(r -> new OverdueItemVO(r.getId(), r.getType().name(), r.getParty(),
                        r.getAmount(), r.getDaysOverdue(), r.getWeddingId()))
                .collect(Collectors.toList());
    }
}
