package com.heritage.service;

import com.heritage.entity.TrainingPlan;
import com.heritage.entity.TrainingRecord;
import com.heritage.repository.TrainingPlanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TrainingService {

    @Autowired
    private TrainingPlanRepository trainingPlanRepository;

    public Page<TrainingPlan> getAllPlans(Pageable pageable) {
        return trainingPlanRepository.findAll(pageable);
    }

    public Page<TrainingPlan> getPlansByInheritor(String inheritorId, Pageable pageable) {
        return trainingPlanRepository.findByInheritorId(inheritorId, pageable);
    }

    public List<TrainingPlan> getPlansByInheritorAndYear(String inheritorId, String year) {
        return trainingPlanRepository.findByInheritorIdAndYear(inheritorId, year);
    }

    public List<TrainingPlan> getPlansByYear(String year) {
        return trainingPlanRepository.findByYear(year);
    }

    public TrainingPlan getPlanById(String id) {
        return trainingPlanRepository.findById(id).orElse(null);
    }

    @Transactional
    public TrainingPlan createPlan(TrainingPlan plan) {
        plan.setId(null);
        plan.setCompletedHours(0);
        plan.setCompletedAssessments(0);
        plan.setProgressStatus("NOT_STARTED");
        return trainingPlanRepository.save(plan);
    }

    @Transactional
    public TrainingPlan updatePlan(String id, TrainingPlan plan) {
        TrainingPlan existing = trainingPlanRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("培养计划不存在"));

        existing.setPlanName(plan.getPlanName());
        existing.setObjectives(plan.getObjectives());
        existing.setTargetApprenticeCount(plan.getTargetApprenticeCount());
        existing.setTargetTeachingHours(plan.getTargetTeachingHours());
        existing.setStartDate(plan.getStartDate());
        existing.setEndDate(plan.getEndDate());

        return trainingPlanRepository.save(existing);
    }

    @Transactional
    public TrainingPlan addTrainingRecord(String planId, TrainingRecord record) {
        TrainingPlan plan = trainingPlanRepository.findById(planId)
                .orElseThrow(() -> new RuntimeException("培养计划不存在"));

        plan.getTrainingRecords().add(record);
        plan.setCompletedHours(plan.getCompletedHours() + record.getDurationHours());

        if (record.getAssessmentScore() != null && !record.getAssessmentScore().isEmpty()) {
            plan.setCompletedAssessments(plan.getCompletedAssessments() + 1);
        }

        double progress = 0;
        if (plan.getTargetTeachingHours() > 0) {
            progress = plan.getCompletedHours() / plan.getTargetTeachingHours() * 100;
        }

        if (progress <= 0) {
            plan.setProgressStatus("NOT_STARTED");
        } else if (progress < 100) {
            plan.setProgressStatus("IN_PROGRESS");
        } else {
            plan.setProgressStatus("COMPLETED");
        }

        return trainingPlanRepository.save(plan);
    }

    public void deletePlan(String id) {
        trainingPlanRepository.deleteById(id);
    }

    public String generateProgressReport(String planId) {
        TrainingPlan plan = trainingPlanRepository.findById(planId)
                .orElseThrow(() -> new RuntimeException("培养计划不存在"));

        double progressPercent = plan.getTargetTeachingHours() > 0
                ? (plan.getCompletedHours() / plan.getTargetTeachingHours() * 100)
                : 0;

        StringBuilder report = new StringBuilder();
        report.append("传承培养计划进度报告\n");
        report.append("========================\n");
        report.append("计划名称: ").append(plan.getPlanName()).append("\n");
        report.append("年度: ").append(plan.getYear()).append("\n");
        report.append("目标授课时长: ").append(plan.getTargetTeachingHours()).append("小时\n");
        report.append("已完成授课时长: ").append(plan.getCompletedHours()).append("小时\n");
        report.append("进度: ").append(String.format("%.1f", progressPercent)).append("%\n");
        report.append("目标收徒人数: ").append(plan.getTargetApprenticeCount()).append("人\n");
        report.append("已完成考核: ").append(plan.getCompletedAssessments()).append("次\n");
        report.append("状态: ").append(plan.getProgressStatus()).append("\n");
        report.append("\n培训记录:\n");

        for (int i = 0; i < plan.getTrainingRecords().size(); i++) {
            TrainingRecord r = plan.getTrainingRecords().get(i);
            report.append(String.format("%d. %s - %.1f小时 - %s\n",
                    i + 1, r.getTrainingDate(), r.getDurationHours(), r.getContent()));
        }

        return report.toString();
    }
}
