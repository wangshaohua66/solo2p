package com.iccert.task.service;

import com.iccert.common.exception.BusinessException;
import com.iccert.common.result.ResultCode;
import com.iccert.common.utils.CodeGenerator;
import com.iccert.task.entity.InspectionTask;
import com.iccert.task.entity.LabEquipment;
import com.iccert.task.entity.LabTechnician;
import com.iccert.task.mapper.InspectionTaskMapper;
import com.iccert.task.mapper.LabEquipmentMapper;
import com.iccert.task.mapper.LabTechnicianMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskDispatchService {

    private final InspectionTaskMapper taskMapper;
    private final LabEquipmentMapper equipmentMapper;
    private final LabTechnicianMapper technicianMapper;

    @Value("${dispatch.algorithm.load-weight:0.6}")
    private double loadWeight;
    @Value("${dispatch.algorithm.skill-weight:0.4}")
    private double skillWeight;
    @Value("${dispatch.algorithm.max-workload:85}")
    private int maxWorkload;

    @Transactional
    public Map<String, Object> autoDispatchAllPending() {
        List<InspectionTask> pendingTasks = taskMapper.selectPendingTasks();
        Map<String, Object> result = new HashMap<>();
        List<InspectionTask> success = new ArrayList<>();
        List<Map<String, Object>> failed = new ArrayList<>();
        for (InspectionTask task : pendingTasks) {
            try {
                InspectionTask dispatched = dispatchSingleTask(task);
                success.add(dispatched);
            } catch (Exception e) {
                Map<String, Object> fail = new HashMap<>();
                fail.put("taskId", task.getId());
                fail.put("taskCode", task.getTaskCode());
                fail.put("reason", e.getMessage());
                failed.add(fail);
            }
        }
        result.put("successCount", success.size());
        result.put("failedCount", failed.size());
        result.put("successTasks", success);
        result.put("failedTasks", failed);
        return result;
    }

    @Transactional
    public InspectionTask dispatchSingleTask(InspectionTask task) {
        String certType = task.getCertTypeCode();
        String skillKeyword = mapCertTypeToSkill(certType);

        List<LabTechnician> techs = technicianMapper.selectBySkill(skillKeyword);
        if (techs.isEmpty()) techs = technicianMapper.selectAvailableTechnicians();
        if (techs.isEmpty()) throw new BusinessException(ResultCode.TASK_DISPATCH_FAIL, "无可用技术员");

        LabTechnician bestTech = null;
        double bestScore = -1;
        for (LabTechnician tech : techs) {
            if (tech.getWorkload() >= maxWorkload) continue;
            double skillScore = calculateSkillScore(tech, skillKeyword);
            double loadScore = 1.0 - (tech.getWorkload() / 100.0);
            double total = skillWeight * skillScore + loadWeight * loadScore;
            if (total > bestScore) {
                bestScore = total;
                bestTech = tech;
            }
        }
        if (bestTech == null) throw new BusinessException(ResultCode.TASK_DISPATCH_FAIL, "所有技术员工作量已满");

        List<LabEquipment> equipments = equipmentMapper.selectIdleEquipments();
        LabEquipment bestEquip = equipments.isEmpty() ? null : equipments.get(0);
        LocalDateTime startTime = LocalDateTime.now().plusHours(1);
        LocalDateTime endTime = startTime.plusHours(4);
        if (bestEquip != null) {
            boolean conflict = equipmentMapper.hasBookingConflict(bestEquip.getId(), startTime, endTime);
            if (conflict) {
                for (LabEquipment eq : equipments) {
                    if (!equipmentMapper.hasBookingConflict(eq.getId(), startTime, endTime)) {
                        bestEquip = eq;
                        break;
                    }
                }
            }
        }

        task.setTechnicianId(bestTech.getId());
        task.setTechnicianName(bestTech.getTechnicianName());
        task.setEquipmentId(bestEquip != null ? bestEquip.getId() : null);
        task.setEquipmentName(bestEquip != null ? bestEquip.getEquipmentName() : null);
        task.setTaskStatus("IN_PROGRESS");
        task.setProgress(0);
        task.setAssignTime(LocalDateTime.now());
        task.setStartTime(startTime);
        task.setAutoDispatched(1);
        task.setDispatchAlgorithm("WEIGHTED_V1");
        taskMapper.updateById(task);

        bestTech.setWorkload(Math.min(100, bestTech.getWorkload() + 10));
        technicianMapper.updateById(bestTech);
        if (bestEquip != null) {
            bestEquip.setCurrentLoad(Math.min(100, bestEquip.getCurrentLoad() + 15));
            bestEquip.setEquipmentStatus("RUNNING");
            equipmentMapper.updateById(bestEquip);
        }
        log.info("任务自动调度: {} -> 技术员:{}, 设备:{}",
                task.getTaskCode(), bestTech.getTechnicianName(),
                bestEquip != null ? bestEquip.getEquipmentName() : "无");
        return task;
    }

    public boolean checkEquipmentBookingConflict(Long equipmentId, LocalDateTime startTime, LocalDateTime endTime) {
        boolean conflict = equipmentMapper.hasBookingConflict(equipmentId, startTime, endTime);
        if (conflict) log.warn("设备预约冲突预警: equipmentId={}, 时间段:{} ~ {}", equipmentId, startTime, endTime);
        return conflict;
    }

    private double calculateSkillScore(LabTechnician tech, String skillKeyword) {
        int certCount = tech.getCertCount() != null ? tech.getCertCount() : 0;
        double base = Math.min(1.0, certCount / 5.0);
        return base;
    }

    private String mapCertTypeToSkill(String certType) {
        return switch (certType) {
            case "CCC", "CE", "FDA" -> "电气安全检测";
            case "ROHS", "REACH" -> "化学分析检测";
            case "ISO" -> "体系审核";
            default -> "通用检测";
        };
    }

    public InspectionTask createTask(InspectionTask task) {
        task.setTaskCode(CodeGenerator.genTaskCode());
        task.setTaskStatus("PENDING");
        task.setProgress(0);
        taskMapper.insert(task);
        return task;
    }

    public List<InspectionTask> listAll() {
        return taskMapper.selectList(null);
    }
}
