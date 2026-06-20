package com.design.collaboration.service;

import com.design.collaboration.dto.ProjectCreateRequest;
import com.design.collaboration.entity.Project;
import com.design.collaboration.entity.ProjectLog;
import com.design.collaboration.entity.ProjectProfessional;
import com.design.collaboration.entity.User;
import com.design.collaboration.enums.ProjectStatus;
import com.design.collaboration.enums.ProjectType;
import com.design.collaboration.mapper.ProjectMapper;
import com.design.collaboration.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ProjectService {

    @Autowired
    private ProjectMapper projectMapper;

    @Autowired
    private UserMapper userMapper;

    public Project findById(Long id) {
        return projectMapper.findById(id);
    }

    public List<Project> findByConditions(String keyword, ProjectType type, ProjectStatus status,
                                          LocalDate startDate, LocalDate endDate) {
        return projectMapper.findByConditions(keyword, type, status, startDate, endDate);
    }

    public Map<String, Long> getStatistics() {
        Map<String, Long> stats = new HashMap<>();
        stats.put("total", projectMapper.countAll());
        stats.put("inProgress", projectMapper.countByStatus(ProjectStatus.IN_PROGRESS));
        stats.put("reviewing", projectMapper.countByStatus(ProjectStatus.REVIEWING));
        stats.put("completed", projectMapper.countByStatus(ProjectStatus.COMPLETED));
        return stats;
    }

    public List<ProjectProfessional> findProfessionalsByProjectId(Long projectId) {
        return projectMapper.findProfessionalsByProjectId(projectId);
    }

    public Project create(ProjectCreateRequest request, Long operatorId) {
        Project project = new Project();
        project.setName(request.getName());
        project.setType(request.getType());
        project.setStage(request.getStage());
        project.setStatus(request.getStatus() != null ? request.getStatus() : ProjectStatus.PENDING);
        project.setContractAmount(request.getContractAmount());
        project.setStartDate(request.getStartDate());
        project.setEndDate(request.getEndDate());
        project.setClientName(request.getClientName());
        project.setClientContact(request.getClientContact());
        project.setClientPhone(request.getClientPhone());
        project.setProjectManagerId(request.getProjectManagerId());
        project.setDescription(request.getDescription());
        project.setProgress(0);

        String year = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy"));
        long count = projectMapper.countAll();
        project.setProjectNo(String.format("PRJ-%s-%03d", year, count + 1));

        projectMapper.insert(project);

        User operator = operatorId != null ? userMapper.findById(operatorId) : null;
        addLog(project.getId(), "CREATE", "创建项目：" + project.getName(),
                operatorId, operator != null ? operator.getName() : null);

        return projectMapper.findById(project.getId());
    }

    public Project update(Long id, ProjectCreateRequest request, Long operatorId) {
        Project project = projectMapper.findById(id);
        if (project == null) {
            throw new RuntimeException("项目不存在");
        }
        project.setName(request.getName());
        project.setType(request.getType());
        project.setStage(request.getStage());
        if (request.getStatus() != null) project.setStatus(request.getStatus());
        project.setContractAmount(request.getContractAmount());
        project.setStartDate(request.getStartDate());
        project.setEndDate(request.getEndDate());
        project.setClientName(request.getClientName());
        project.setClientContact(request.getClientContact());
        project.setClientPhone(request.getClientPhone());
        project.setProjectManagerId(request.getProjectManagerId());
        project.setDescription(request.getDescription());
        projectMapper.update(project);

        User operator = operatorId != null ? userMapper.findById(operatorId) : null;
        addLog(id, "UPDATE", "更新项目信息", operatorId, operator != null ? operator.getName() : null);

        return projectMapper.findById(id);
    }

    public boolean delete(Long id, Long operatorId) {
        User operator = operatorId != null ? userMapper.findById(operatorId) : null;
        addLog(id, "DELETE", "删除项目", operatorId, operator != null ? operator.getName() : null);
        return projectMapper.deleteById(id) > 0;
    }

    public ProjectProfessional assignProfessional(Long projectId, ProjectProfessional pp, Long operatorId) {
        pp.setProjectId(projectId);
        if (pp.getProgress() == null) pp.setProgress(0);
        projectMapper.insertProfessional(pp);

        User operator = operatorId != null ? userMapper.findById(operatorId) : null;
        User lead = pp.getProfessionalLeadId() != null ? userMapper.findById(pp.getProfessionalLeadId()) : null;
        addLog(projectId, "ASSIGN", "分配" + pp.getProfession() + "专业负责人：" + (lead != null ? lead.getName() : ""),
                operatorId, operator != null ? operator.getName() : null);

        return pp;
    }

    public void recalculateProgress(Long projectId) {
        List<ProjectProfessional> professionals = projectMapper.findProfessionalsByProjectId(projectId);
        if (professionals != null && !professionals.isEmpty()) {
            int total = professionals.stream().mapToInt(p -> p.getProgress() != null ? p.getProgress() : 0).sum();
            int avg = total / professionals.size();
            projectMapper.updateProgress(projectId, avg);
        }
    }

    public void addLog(Long projectId, String action, String content, Long operatorId, String operatorName) {
        ProjectLog log = new ProjectLog();
        log.setProjectId(projectId);
        log.setAction(action);
        log.setContent(content);
        log.setOperatorId(operatorId);
        log.setOperatorName(operatorName);
        log.setCreatedAt(LocalDateTime.now());
        projectMapper.insertLog(log);
    }

    public List<ProjectLog> findLogsByProjectId(Long projectId) {
        return projectMapper.findLogsByProjectId(projectId);
    }
}
