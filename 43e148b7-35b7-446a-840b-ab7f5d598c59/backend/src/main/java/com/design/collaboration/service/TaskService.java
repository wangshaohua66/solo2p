package com.design.collaboration.service;

import com.design.collaboration.dto.TaskCreateRequest;
import com.design.collaboration.entity.DesignTask;
import com.design.collaboration.entity.Project;
import com.design.collaboration.entity.ProjectProfessional;
import com.design.collaboration.entity.User;
import com.design.collaboration.enums.ProfessionType;
import com.design.collaboration.enums.TaskStatus;
import com.design.collaboration.mapper.ProjectMapper;
import com.design.collaboration.mapper.TaskMapper;
import com.design.collaboration.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class TaskService {

    @Autowired
    private TaskMapper taskMapper;

    @Autowired
    private ProjectMapper projectMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private ProjectService projectService;

    public DesignTask findById(Long id) {
        return taskMapper.findById(id);
    }

    public List<DesignTask> findByConditions(Long projectId, ProfessionType profession,
                                              TaskStatus status, Long assigneeId) {
        return taskMapper.findByConditions(projectId, profession, status, assigneeId);
    }

    public DesignTask create(TaskCreateRequest request, Long operatorId) {
        DesignTask task = new DesignTask();
        task.setProjectId(request.getProjectId());
        task.setStage(request.getStage());
        task.setProfession(request.getProfession());
        task.setName(request.getName());
        task.setDescription(request.getDescription());
        task.setParentId(request.getParentId());
        task.setAssigneeId(request.getAssigneeId());
        task.setStatus(request.getStatus() != null ? request.getStatus() : TaskStatus.PENDING);
        task.setProgress(request.getProgress() != null ? request.getProgress() : 0);
        task.setPlannedStartDate(request.getPlannedStartDate());
        task.setPlannedEndDate(request.getPlannedEndDate());
        task.setDeliverables(request.getDeliverables());

        if (request.getAssigneeId() != null && task.getStatus() == TaskStatus.PENDING) {
            task.setStatus(TaskStatus.IN_PROGRESS);
            task.setActualStartDate(LocalDate.now());
        }

        taskMapper.insert(task);

        User operator = operatorId != null ? userMapper.findById(operatorId) : null;
        projectService.addLog(request.getProjectId(), "TASK",
                "创建任务：" + task.getName(), operatorId, operator != null ? operator.getName() : null);

        recalculateProjectProfessionProgress(request.getProjectId(), request.getProfession());

        return taskMapper.findById(task.getId());
    }

    public DesignTask update(Long id, TaskCreateRequest request) {
        DesignTask task = taskMapper.findById(id);
        if (task == null) {
            throw new RuntimeException("任务不存在");
        }
        if (request.getName() != null) task.setName(request.getName());
        if (request.getDescription() != null) task.setDescription(request.getDescription());
        if (request.getStage() != null) task.setStage(request.getStage());
        if (request.getProfession() != null) task.setProfession(request.getProfession());
        if (request.getAssigneeId() != null) task.setAssigneeId(request.getAssigneeId());
        if (request.getStatus() != null) task.setStatus(request.getStatus());
        if (request.getProgress() != null) task.setProgress(request.getProgress());
        if (request.getPlannedStartDate() != null) task.setPlannedStartDate(request.getPlannedStartDate());
        if (request.getPlannedEndDate() != null) task.setPlannedEndDate(request.getPlannedEndDate());
        if (request.getDeliverables() != null) task.setDeliverables(request.getDeliverables());
        taskMapper.update(task);

        recalculateProjectProfessionProgress(task.getProjectId(), task.getProfession());

        return taskMapper.findById(id);
    }

    public DesignTask claimTask(Long id, Long userId) {
        DesignTask task = taskMapper.findById(id);
        if (task == null) {
            throw new RuntimeException("任务不存在");
        }
        if (task.getStatus() != TaskStatus.PENDING) {
            throw new RuntimeException("该任务状态不支持领取");
        }
        taskMapper.assignTask(id, userId);

        User user = userMapper.findById(userId);
        projectService.addLog(task.getProjectId(), "TASK",
                "领取任务：" + task.getName() + "，负责人：" + (user != null ? user.getName() : ""),
                userId, user != null ? user.getName() : null);

        recalculateProjectProfessionProgress(task.getProjectId(), task.getProfession());

        return taskMapper.findById(id);
    }

    public DesignTask updateProgress(Long id, Integer progress, TaskStatus status) {
        DesignTask task = taskMapper.findById(id);
        if (task == null) {
            throw new RuntimeException("任务不存在");
        }
        TaskStatus newStatus = status != null ? status : task.getStatus();
        taskMapper.updateStatusAndProgress(id, newStatus, progress);

        if (newStatus == TaskStatus.COMPLETED) {
            task.setActualEndDate(LocalDate.now());
            taskMapper.update(task);
        }

        recalculateProjectProfessionProgress(task.getProjectId(), task.getProfession());

        return taskMapper.findById(id);
    }

    public boolean delete(Long id) {
        DesignTask task = taskMapper.findById(id);
        if (task == null) {
            return false;
        }
        int result = taskMapper.deleteById(id);
        if (result > 0) {
            recalculateProjectProfessionProgress(task.getProjectId(), task.getProfession());
        }
        return result > 0;
    }

    private void recalculateProjectProfessionProgress(Long projectId, ProfessionType profession) {
        if (projectId == null || profession == null) return;

        Integer avgProgress = taskMapper.calculateProgressByProjectAndProfession(projectId, profession);
        if (avgProgress != null) {
            List<ProjectProfessional> professionals = projectMapper.findProfessionalsByProjectId(projectId);
            for (ProjectProfessional pp : professionals) {
                if (pp.getProfession() == profession) {
                    pp.setProgress(avgProgress);
                    projectMapper.updateProfessional(pp);
                    break;
                }
            }
            projectService.recalculateProgress(projectId);
        }
    }
}
