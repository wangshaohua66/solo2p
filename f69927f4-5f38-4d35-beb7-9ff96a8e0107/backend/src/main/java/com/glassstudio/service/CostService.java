package com.glassstudio.service;

import com.glassstudio.entity.CostRecord;
import com.glassstudio.entity.Kiln;
import com.glassstudio.entity.Schedule;
import com.glassstudio.exception.NotFoundException;
import com.glassstudio.repository.CostRecordRepository;
import com.glassstudio.repository.KilnRepository;
import com.glassstudio.repository.ScheduleRepository;
import com.glassstudio.repository.BatchRepository;
import com.glassstudio.entity.Batch;
import com.glassstudio.entity.BatchStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CostService {

    private final CostRecordRepository costRecordRepository;
    private final ScheduleRepository scheduleRepository;
    private final KilnRepository kilnRepository;
    private final BatchRepository batchRepository;

    private static final BigDecimal ELECTRICITY_RATE = new BigDecimal("1.2");
    private static final BigDecimal LABOR_RATE_PER_HOUR = new BigDecimal("50");
    private static final BigDecimal DEFAULT_POWER_KW = new BigDecimal("5.0");
    private static final BigDecimal MATERIAL_PER_WORKPIECE_KG = new BigDecimal("0.5");

    public CostRecord getCostByScheduleId(Long scheduleId) {
        return costRecordRepository.findByScheduleId(scheduleId)
                .orElseThrow(() -> new NotFoundException("成本记录不存在"));
    }

    @Transactional
    public CostRecord calculateScheduleCost(Long scheduleId) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new NotFoundException("排程不存在"));

        if (costRecordRepository.existsByScheduleId(scheduleId)) {
            return costRecordRepository.findByScheduleId(scheduleId).get();
        }

        long hours = ChronoUnit.HOURS.between(schedule.getStartTime(), schedule.getEndTime());
        if (hours <= 0) {
            hours = 1;
        }
        BigDecimal hoursDec = BigDecimal.valueOf(hours);

        Kiln kiln = kilnRepository.findById(schedule.getKilnId()).orElse(null);
        BigDecimal powerKw = (kiln != null && kiln.getPowerKw() != null)
                ? kiln.getPowerKw()
                : DEFAULT_POWER_KW;

        BigDecimal electricityCost = powerKw
                .multiply(hoursDec)
                .multiply(ELECTRICITY_RATE)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal materialCost = calculateMaterialCost(schedule);

        BigDecimal laborCost = LABOR_RATE_PER_HOUR
                .multiply(hoursDec)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal totalCost = electricityCost
                .add(materialCost)
                .add(laborCost);

        BigDecimal costPerWorkpiece = totalCost
                .divide(BigDecimal.valueOf(schedule.getWorkpieceCount()), 2, RoundingMode.HALF_UP);

        CostRecord costRecord = CostRecord.builder()
                .scheduleId(scheduleId)
                .electricityCost(electricityCost)
                .materialCost(materialCost)
                .laborCost(laborCost)
                .totalCost(totalCost)
                .costPerWorkpiece(costPerWorkpiece)
                .build();

        return costRecordRepository.save(costRecord);
    }

    private BigDecimal calculateMaterialCost(Schedule schedule) {
        BigDecimal totalMaterialKg = MATERIAL_PER_WORKPIECE_KG
                .multiply(BigDecimal.valueOf(schedule.getWorkpieceCount()));

        List<Batch> batches = batchRepository
                .findByMaterialNameAndStatusOrderByCreatedAtAsc("玻璃原料", BatchStatus.IN_STOCK);

        if (batches.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal remaining = totalMaterialKg;
        BigDecimal totalCost = BigDecimal.ZERO;

        for (Batch batch : batches) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
                break;
            }
            BigDecimal takeQty = remaining.min(batch.getQuantity());
            BigDecimal unitPrice = batch.getUnitPrice() != null ? batch.getUnitPrice() : BigDecimal.ZERO;
            totalCost = totalCost.add(takeQty.multiply(unitPrice));
            remaining = remaining.subtract(takeQty);
        }

        return totalCost.setScale(2, RoundingMode.HALF_UP);
    }

    public Map<String, Object> getMonthlyReport(int year, int month) {
        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();

        List<Schedule> schedules = scheduleRepository.findAll();

        BigDecimal totalElectricityCost = BigDecimal.ZERO;
        BigDecimal totalMaterialCost = BigDecimal.ZERO;
        BigDecimal totalLaborCost = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        int totalWorkpieces = 0;
        int scheduleCount = 0;

        for (Schedule schedule : schedules) {
            LocalDateTime scheduleDate = schedule.getStartTime();
            LocalDate date = scheduleDate.toLocalDate();
            if (date.isBefore(startDate) || date.isAfter(endDate)) {
                continue;
            }

            try {
                CostRecord cost = costRecordRepository.findByScheduleId(schedule.getId()).orElse(null);
                if (cost != null) {
                    totalElectricityCost = totalElectricityCost.add(cost.getElectricityCost());
                    totalMaterialCost = totalMaterialCost.add(cost.getMaterialCost());
                    totalLaborCost = totalLaborCost.add(cost.getLaborCost());
                    totalCost = totalCost.add(cost.getTotalCost());
                    totalWorkpieces += schedule.getWorkpieceCount();
                    scheduleCount++;
                }
            } catch (Exception e) {
                // skip
            }
        }

        Map<String, Object> report = new HashMap<>();
        report.put("year", year);
        report.put("month", month);
        report.put("scheduleCount", scheduleCount);
        report.put("totalWorkpieces", totalWorkpieces);
        report.put("totalElectricityCost", totalElectricityCost);
        report.put("totalMaterialCost", totalMaterialCost);
        report.put("totalLaborCost", totalLaborCost);
        report.put("totalCost", totalCost);
        report.put("avgCostPerSchedule", scheduleCount > 0 ?
                totalCost.divide(BigDecimal.valueOf(scheduleCount), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO);

        return report;
    }

    public byte[] exportMonthlyReport(int year, int month) {
        Map<String, Object> report = getMonthlyReport(year, month);

        StringBuilder csv = new StringBuilder();
        csv.append("月份,排程数,工件总数,电费,材料费,人工费,总成本,平均每排程成本\n");
        csv.append(year).append("-").append(month).append(",")
                .append(report.get("scheduleCount")).append(",")
                .append(report.get("totalWorkpieces")).append(",")
                .append(report.get("totalElectricityCost")).append(",")
                .append(report.get("totalMaterialCost")).append(",")
                .append(report.get("totalLaborCost")).append(",")
                .append(report.get("totalCost")).append(",")
                .append(report.get("avgCostPerSchedule")).append("\n");

        return csv.toString().getBytes();
    }
}
