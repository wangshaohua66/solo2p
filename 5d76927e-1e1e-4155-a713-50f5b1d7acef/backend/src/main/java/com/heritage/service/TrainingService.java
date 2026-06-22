package com.heritage.service;

import com.heritage.entity.TrainingPlan;
import com.heritage.entity.TrainingRecord;
import com.heritage.entity.User;
import com.heritage.enums.UserRole;
import com.heritage.repository.TrainingPlanRepository;
import com.heritage.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
public class TrainingService {

    @Autowired
    private TrainingPlanRepository trainingPlanRepository;

    @Autowired
    private UserRepository userRepository;

    public Page<TrainingPlan> getAllPlans(Pageable pageable) {
        return trainingPlanRepository.findAll(pageable);
    }

    public Page<TrainingPlan> getPlansByInheritor(String inheritorId, Pageable pageable) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String currentUsername = auth.getName();
        log.info("[数据权限校验] getPlansByInheritor 调用中 - 传承人ID: {}, 当前登录用户: {}", inheritorId, currentUsername);

        User currentUser = userRepository.findByUsername(currentUsername).orElse(null);
        if (currentUser == null) {
            log.warn("[数据权限校验] 当前用户 {} 未找到，拒绝访问", currentUsername);
            throw new SecurityException("用户信息不存在，无法进行权限校验");
        }

        boolean isAdminOrStaff = currentUser.getRoles() != null &&
                (currentUser.getRoles().contains(UserRole.ADMIN) || currentUser.getRoles().contains(UserRole.STAFF));
        boolean isInheritorRole = currentUser.getRoles() != null &&
                currentUser.getRoles().contains(UserRole.INHERITOR);

        if (isAdminOrStaff) {
            log.info("[数据权限校验] 用户 {} 角色为 ADMIN/STAFF，允许查询传承人 {} 的培养计划", currentUsername, inheritorId);
            return trainingPlanRepository.findByInheritorId(inheritorId, pageable);
        }

        if (isInheritorRole) {
            String userInheritorId = currentUser.getInheritorId();
            log.info("[数据权限校验] 用户 {} 为 INHERITOR 角色，绑定传承人ID: {}", currentUsername, userInheritorId);

            if (userInheritorId == null || userInheritorId.isEmpty()) {
                log.warn("[数据权限校验] 用户 {} 为传承人角色但未绑定inheritorId，拒绝访问", currentUsername);
                throw new SecurityException("当前传承人账户未绑定有效的传承人档案ID，请联系管理员配置");
            }

            if (!userInheritorId.equals(inheritorId)) {
                log.warn("[数据权限校验] 越权访问：用户 {} (inheritorId={}) 尝试访问传承人 {} 的培养计划，已拒绝",
                        currentUsername, userInheritorId, inheritorId);
                throw new SecurityException("数据访问权限不足：只能查看与本人绑定的传承人培养计划");
            }

            log.info("[数据权限校验] 用户 {} 确认访问自己 (inheritorId={}) 的培养计划，校验通过", currentUsername, userInheritorId);
            return trainingPlanRepository.findByInheritorId(inheritorId, pageable);
        }

        log.warn("[数据权限校验] 用户 {} 的角色 {} 无权访问传承人培养计划", currentUsername, currentUser.getRoles());
        throw new SecurityException("当前用户角色无权访问传承培养计划数据");
    }

    public List<TrainingPlan> getPlansByInheritorAndYear(String inheritorId, String year) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String currentUsername = auth.getName();

        User currentUser = userRepository.findByUsername(currentUsername).orElse(null);
        if (currentUser == null) {
            throw new SecurityException("用户信息不存在");
        }

        boolean isAdminOrStaff = currentUser.getRoles() != null &&
                (currentUser.getRoles().contains(UserRole.ADMIN) || currentUser.getRoles().contains(UserRole.STAFF));
        boolean isInheritorRole = currentUser.getRoles() != null &&
                currentUser.getRoles().contains(UserRole.INHERITOR);

        if (isAdminOrStaff) {
            return trainingPlanRepository.findByInheritorIdAndYear(inheritorId, year);
        }

        if (isInheritorRole) {
            String userInheritorId = currentUser.getInheritorId();
            if (!inheritorId.equals(userInheritorId)) {
                throw new SecurityException("只能查看本人的年度培养计划");
            }
            return trainingPlanRepository.findByInheritorIdAndYear(inheritorId, year);
        }

        throw new SecurityException("当前用户角色无权访问年度培养计划");
    }

    public List<TrainingPlan> getPlansByYear(String year) {
        return trainingPlanRepository.findByYear(year);
    }

    public TrainingPlan getPlanById(String id) {
        TrainingPlan plan = trainingPlanRepository.findById(id).orElse(null);
        if (plan == null) return null;

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String currentUsername = auth.getName();
        User currentUser = userRepository.findByUsername(currentUsername).orElse(null);
        if (currentUser == null) {
            throw new SecurityException("用户信息不存在");
        }

        boolean isAdminOrStaff = currentUser.getRoles() != null &&
                (currentUser.getRoles().contains(UserRole.ADMIN) || currentUser.getRoles().contains(UserRole.STAFF));
        boolean isInheritorRole = currentUser.getRoles() != null &&
                currentUser.getRoles().contains(UserRole.INHERITOR);

        if (isAdminOrStaff) return plan;
        if (isInheritorRole && plan.getInheritorId().equals(currentUser.getInheritorId())) return plan;

        throw new SecurityException("无权查看该培养计划详情");
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

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String currentUsername = auth.getName();
        User currentUser = userRepository.findByUsername(currentUsername).orElse(null);
        if (currentUser != null && currentUser.getRoles() != null &&
                currentUser.getRoles().contains(UserRole.INHERITOR)) {
            String userInheritorId = currentUser.getInheritorId();
            if (userInheritorId == null || !userInheritorId.equals(plan.getInheritorId())) {
                throw new SecurityException("只能为本人的培养计划添加培训记录");
            }
        }

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
