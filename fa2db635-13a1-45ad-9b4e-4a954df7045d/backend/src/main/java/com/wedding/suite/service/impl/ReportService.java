package com.wedding.suite.service.impl;

import com.wedding.suite.dto.response.FunnelDataVO;
import com.wedding.suite.dto.response.RevenuePointVO;
import com.wedding.suite.dto.response.ScoreDataVO;
import com.wedding.suite.dto.response.SummaryVO;
import com.wedding.suite.entity.FinanceEntity;
import com.wedding.suite.entity.ReceivablePayableEntity;
import com.wedding.suite.entity.WeddingEntity;
import com.wedding.suite.enums.ContractStatus;
import com.wedding.suite.enums.FinanceType;
import com.wedding.suite.enums.ScheduleStatus;
import com.wedding.suite.enums.WeddingStage;
import com.wedding.suite.repository.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Service
public class ReportService {

    private final WeddingRepository weddingRepo;
    private final ContractRepository contractRepo;
    private final FinanceRepository financeRepo;
    private final ReceivablePayableRepository rpRepo;
    private final ScheduleTaskRepository scheduleRepo;

    public ReportService(WeddingRepository weddingRepo, ContractRepository contractRepo,
                        FinanceRepository financeRepo, ReceivablePayableRepository rpRepo,
                        ScheduleTaskRepository scheduleRepo) {
        this.weddingRepo = weddingRepo;
        this.contractRepo = contractRepo;
        this.financeRepo = financeRepo;
        this.rpRepo = rpRepo;
        this.scheduleRepo = scheduleRepo;
    }

    public List<RevenuePointVO> revenue(Long storeId) {
        List<WeddingEntity> list = storeId == null ? weddingRepo.findAll() : weddingRepo.findByStoreId(storeId);
        List<RevenuePointVO> result = new ArrayList<>();
        for (WeddingEntity w : list) {
            BigDecimal amount = w.getQuoteTotal() == null ? BigDecimal.ZERO : w.getQuoteTotal();
            result.add(new RevenuePointVO(w.getWeddingDate().toString(), amount));
        }
        return result;
    }

    public List<FunnelDataVO> funnel() {
        List<WeddingEntity> all = weddingRepo.findAll();
        String[] labels = {"咨询", "方案设计", "合同签订", "筹备执行", "现场督导", "后期交付"};
        WeddingStage[] stages = WeddingStage.values();
        List<FunnelDataVO> result = new ArrayList<>();
        for (int i = 0; i < labels.length; i++) {
            final int idx = i;
            long count = all.stream()
                    .filter(w -> Arrays.asList(stages).indexOf(w.getStage()) >= idx)
                    .count();
            result.add(new FunnelDataVO(labels[i], count));
        }
        return result;
    }

    public List<ScoreDataVO> satisfaction() {
        return List.of(
                new ScoreDataVO("策划专业", 4.7),
                new ScoreDataVO("现场执行", 4.8),
                new ScoreDataVO("人员配合", 4.5),
                new ScoreDataVO("性价比", 4.3),
                new ScoreDataVO("售后跟进", 4.6));
    }

    public SummaryVO summary() {
        List<WeddingEntity> weddings = weddingRepo.findAll();
        List<FinanceEntity> finances = financeRepo.findAll();
        BigDecimal revenue = weddings.stream()
                .map(w -> w.getQuoteTotal() == null ? BigDecimal.ZERO : w.getQuoteTotal())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cost = finances.stream().map(FinanceEntity::getCost).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal profit = revenue.subtract(cost);
        long signed = contractRepo.countByStatus(ContractStatus.SIGNED);
        long conflictAlerts = scheduleRepo.findAll().stream()
                .filter(t -> t.getStatus() == ScheduleStatus.CONFLICT).count();
        BigDecimal overdue = rpRepo.findByTypeAndSettledFalse(FinanceType.RECEIVABLE).stream()
                .map(ReceivablePayableEntity::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new SummaryVO(revenue, cost, profit, weddings.size(), signed, conflictAlerts, overdue);
    }
}
