package com.glassstudio.service;

import com.glassstudio.entity.CostRecord;
import com.glassstudio.entity.Schedule;
import com.glassstudio.exception.NotFoundException;
import com.glassstudio.repository.CostRecordRepository;
import com.glassstudio.repository.ScheduleRepository;
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

    private static final BigDecimal ELECTRICITY_RATE = new BigDecimal("1.5");
    private static final BigDecimal LABOR_RATE_PER_HOUR = new BigDecimal("50");

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

        BigDecimal electricityCost = ELECTRICITY_RATE
                .multiply(new BigDecimal(hours))
                .multiply(new BigDecimal("5"))
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal laborCost = LABOR_RATE_PER_HOUR
                .multiply(new BigDecimal(hours))
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal materialCost = BigDecimal.ZERO;

        BigDecimal totalCost = electricityCost
                .add(materialCost)
                .add(laborCost);

        BigDecimal costPerWorkpiece = totalCost
                .divide(new BigDecimal(schedule.getWorkpieceCount()), 2, RoundingMode.HALF_UP);

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
            if (!scheduleDate.toLocalDate().isBefore(startDate) ||
                scheduleDate.toLocalDate().isAfter(endDate)) {
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
