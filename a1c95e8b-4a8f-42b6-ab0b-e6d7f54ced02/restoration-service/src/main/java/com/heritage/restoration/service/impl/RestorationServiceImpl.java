package com.heritage.restoration.service.impl;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.heritage.restoration.dto.ProgressUpdateDTO;
import com.heritage.restoration.dto.ProjectCreateDTO;
import com.heritage.restoration.dto.ProjectSearchDTO;
import com.heritage.restoration.entity.RestorationLog;
import com.heritage.restoration.entity.RestorationMaterial;
import com.heritage.restoration.entity.RestorationPhoto;
import com.heritage.restoration.entity.RestorationProject;
import com.heritage.restoration.enums.ProjectStatus;
import com.heritage.restoration.feign.ArtifactClient;
import com.heritage.restoration.feign.TraceClient;
import com.heritage.restoration.repository.LogRepository;
import com.heritage.restoration.repository.MaterialRepository;
import com.heritage.restoration.repository.PhotoRepository;
import com.heritage.restoration.repository.ProjectRepository;
import com.heritage.restoration.service.RestorationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RestorationServiceImpl implements RestorationService {

    private final ProjectRepository projectRepo;
    private final LogRepository logRepo;
    private final MaterialRepository materialRepo;
    private final PhotoRepository photoRepo;
    private final MongoTemplate mongoTemplate;
    private final ArtifactClient artifactClient;
    private final TraceClient traceClient;

    @Override
    @Transactional
    public RestorationProject create(ProjectCreateDTO dto, String operatorId, String operatorName) {
        LocalDateTime now = LocalDateTime.now();
        RestorationProject project = new RestorationProject();
        BeanUtils.copyProperties(dto, project);

        project.setProjectCode(generateCode());
        project.setStatus(dto.getStatus() != null ? dto.getStatus() : ProjectStatus.DRAFT);
        project.setProgress(project.getProgress() != null ? project.getProgress() : 0);
        project.setCreatorId(operatorId);
        project.setCreatorName(operatorName);
        project.setCreatedAt(now);
        project.setUpdatedAt(now);
        project.setDeleted(false);

        try {
            var r = artifactClient.getById(dto.getArtifactId());
            if (r != null && r.getData() != null) {
                Map<String, Object> art = r.getData();
                project.setArtifactCode(String.valueOf(art.getOrDefault("artifactCode", "")));
                project.setArtifactName(String.valueOf(art.getOrDefault("name", "")));
            }
        } catch (Exception e) {
            log.warn("Feign调用artifact-service失败，跳过: {}", e.getMessage());
        }

        project = projectRepo.save(project);
        writeLog(project.getId(), "CREATE", "创建修复项目，编号 " + project.getProjectCode(),
                null, project.getStatus().name(), operatorId, operatorName, 0);

        if (project.getStatus() == ProjectStatus.IN_PROGRESS) {
            try {
                Map<String, Object> rec = new HashMap<>();
                rec.put("artifactId", project.getArtifactId());
                rec.put("artifactName", project.getArtifactName());
                rec.put("artifactCode", project.getArtifactCode());
                rec.put("flowType", "START_RESTORE");
                rec.put("operatorName", operatorName);
                rec.put("remark", "修复项目 " + project.getProjectName() + " 已启动");
                traceClient.createRecord(rec);
            } catch (Exception e) {
                log.warn("Feign创建流转记录失败: {}", e.getMessage());
            }
        }
        return project;
    }

    private String generateCode() {
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        return "RS" + datePart + IdUtil.getSnowflakeNextIdStr().substring(6, 12);
    }

    @Override
    public RestorationProject update(String id, ProjectCreateDTO dto) {
        RestorationProject project = getById(id);
        String beforeStatus = project.getStatus().name();
        BeanUtils.copyProperties(dto, project, "id", "projectCode", "createdAt", "deleted");
        project.setUpdatedAt(LocalDateTime.now());
        project = projectRepo.save(project);
        writeLog(id, "UPDATE", "更新项目信息", beforeStatus, project.getStatus().name(),
                project.getCreatorId(), project.getCreatorName(), project.getProgress());
        return project;
    }

    @Override
    public void delete(String id) {
        RestorationProject project = getById(id);
        project.setDeleted(true);
        project.setUpdatedAt(LocalDateTime.now());
        projectRepo.save(project);
        logRepo.save(RestorationLog.builder()
                .projectId(id).action("DELETE").content("项目删除（软删除）")
                .operatorId(project.getCreatorId()).operatorName(project.getCreatorName())
                .createdAt(LocalDateTime.now()).build());
    }

    @Override
    public RestorationProject getById(String id) {
        return projectRepo.findById(id)
                .filter(p -> !Boolean.TRUE.equals(p.getDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("项目不存在或已删除: " + id));
    }

    @Override
    public Page<RestorationProject> search(ProjectSearchDTO dto) {
        Criteria c = Criteria.where("deleted").is(false);
        if (StrUtil.isNotBlank(dto.getKeyword())) {
            String kw = ".*" + dto.getKeyword() + ".*";
            c.andOperator(new Criteria().orOperator(
                    Criteria.where("projectName").regex(kw, "i"),
                    Criteria.where("projectCode").regex(kw, "i"),
                    Criteria.where("artifactName").regex(kw, "i"),
                    Criteria.where("artifactCode").regex(kw, "i"),
                    Criteria.where("description").regex(kw, "i")
            ));
        }
        if (StrUtil.isNotBlank(dto.getArtifactId())) c.and("artifactId").is(dto.getArtifactId());
        if (dto.getStatus() != null) c.and("status").is(dto.getStatus());
        if (dto.getStatusList() != null && !dto.getStatusList().isEmpty()) c.and("status").in(dto.getStatusList());
        if (StrUtil.isNotBlank(dto.getSupervisorId())) c.and("supervisorId").is(dto.getSupervisorId());
        if (StrUtil.isNotBlank(dto.getRestorerId())) c.and("restorerIds").is(dto.getRestorerId());
        if (StrUtil.isNotBlank(dto.getLevel())) c.and("level").is(dto.getLevel());
        if (dto.getRepairTypes() != null && !dto.getRepairTypes().isEmpty()) c.and("repairTypes").in(dto.getRepairTypes());
        if (dto.getStartTime() != null && dto.getEndTime() != null) {
            c.and("createdAt").gte(dto.getStartTime()).lte(dto.getEndTime());
        }
        if (StrUtil.isNotBlank(dto.getInstitution())) c.and("institution").regex(dto.getInstitution(), "i");

        Sort sort = Sort.by(Sort.Direction.fromString(dto.getSortDirection() == null ? "DESC" : dto.getSortDirection()),
                dto.getSortBy() == null ? "createdAt" : dto.getSortBy());
        Pageable pageable = PageRequest.of(dto.getPage(), dto.getSize(), sort);
        Query q = Query.of(c).with(pageable);
        List<RestorationProject> list = mongoTemplate.find(q, RestorationProject.class);
        return PageableExecutionUtils.getPage(list, pageable,
                () -> mongoTemplate.count(Query.of(c), RestorationProject.class));
    }

    @Override
    public RestorationProject updateStatus(String id, String targetStatus, String operatorId, String operatorName) {
        RestorationProject project = getById(id);
        ProjectStatus before = project.getStatus();
        ProjectStatus ts;
        try { ts = ProjectStatus.valueOf(targetStatus); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException("非法状态: " + targetStatus); }
        project.setStatus(ts);
        project.setUpdatedAt(LocalDateTime.now());
        if (ts == ProjectStatus.IN_PROGRESS && project.getActualStartTime() == null) {
            project.setActualStartTime(LocalDateTime.now());
        }
        if (ts == ProjectStatus.COMPLETED || ts == ProjectStatus.ACCEPTED) {
            if (project.getActualEndTime() == null) project.setActualEndTime(LocalDateTime.now());
            if (ts == ProjectStatus.COMPLETED) project.setProgress(100);
        }
        project = projectRepo.save(project);

        writeLog(id, "STATUS", "状态变更：" + before.getLabel() + " → " + ts.getLabel(),
                before.name(), ts.name(), operatorId, operatorName, project.getProgress());

        if (ts == ProjectStatus.COMPLETED) {
            try {
                Map<String, Object> rec = new HashMap<>();
                rec.put("artifactId", project.getArtifactId());
                rec.put("artifactName", project.getArtifactName());
                rec.put("artifactCode", project.getArtifactCode());
                rec.put("flowType", "RESTORE_COMPLETE");
                rec.put("operatorName", operatorName);
                rec.put("remark", "修复项目 " + project.getProjectName() + " 完成，进度100%");
                traceClient.createRecord(rec);
            } catch (Exception e) {
                log.warn("Feign创建流转记录失败: {}", e.getMessage());
            }
        }
        return project;
    }

    @Override
    public RestorationProject updateProgress(String id, ProgressUpdateDTO dto, String operatorId, String operatorName) {
        RestorationProject project = getById(id);
        int p = dto.getProgress();
        if (p < 0 || p > 100) throw new IllegalArgumentException("进度必须在0~100之间");
        Integer beforeProgress = project.getProgress();
        project.setProgress(p);
        project.setUpdatedAt(LocalDateTime.now());
        if (project.getStatus() == ProjectStatus.DRAFT || project.getStatus() == ProjectStatus.APPROVED) {
            project.setStatus(ProjectStatus.IN_PROGRESS);
        }
        project = projectRepo.save(project);
        writeLog(id, "PROGRESS", dto.getContent() + "（进度：" + beforeProgress + "% → " + p + "%）",
                null, project.getStatus().name(), operatorId, operatorName, p);
        return project;
    }

    private void writeLog(String projectId, String action, String content,
                          String beforeStatus, String afterStatus,
                          String operatorId, String operatorName, int progressAfter) {
        logRepo.save(RestorationLog.builder()
                .projectId(projectId).action(action).content(content)
                .beforeStatus(beforeStatus).afterStatus(afterStatus)
                .operatorId(operatorId).operatorName(operatorName)
                .progressAfter(progressAfter).createdAt(LocalDateTime.now()).build());
    }

    @Override
    public List<Map<String, Object>> getLogs(String projectId) {
        getById(projectId);
        return logRepo.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .map(l -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", l.getId());
                    m.put("stage", l.getStage());
                    m.put("action", l.getAction());
                    m.put("content", l.getContent());
                    m.put("progressAfter", l.getProgressAfter());
                    m.put("beforeStatus", l.getBeforeStatus());
                    m.put("afterStatus", l.getAfterStatus());
                    m.put("operatorId", l.getOperatorId());
                    m.put("operatorName", l.getOperatorName());
                    m.put("createdAt", l.getCreatedAt());
                    return m;
                }).collect(Collectors.toList());
    }

    @Override
    public RestorationMaterial addMaterial(String projectId, RestorationMaterial material, String operatorId) {
        getById(projectId);
        material.setProjectId(projectId);
        material.setOperatorId(operatorId);
        material.setUsedAt(material.getUsedAt() != null ? material.getUsedAt() : LocalDateTime.now());
        material.setCreatedAt(LocalDateTime.now());
        if (material.getQuantity() != null && material.getUnitPrice() != null) {
            material.setTotalPrice(material.getQuantity().multiply(material.getUnitPrice()));
        }
        material = materialRepo.save(material);
        writeLog(projectId, "MATERIAL", "登记耗材：" + material.getName() + " x " + material.getQuantity() + material.getUnit(),
                null, null, operatorId, "系统", -1);
        return material;
    }

    @Override
    public List<RestorationMaterial> listMaterials(String projectId) {
        getById(projectId);
        return materialRepo.findByProjectIdOrderByUsedAtDesc(projectId);
    }

    @Override
    public void removeMaterial(String materialId) {
        Optional<RestorationMaterial> om = materialRepo.findById(materialId);
        if (om.isEmpty()) throw new IllegalArgumentException("耗材不存在");
        materialRepo.deleteById(materialId);
    }

    @Override
    public RestorationPhoto addPhoto(String projectId, RestorationPhoto photo) {
        getById(projectId);
        photo.setProjectId(projectId);
        photo.setCreatedAt(LocalDateTime.now());
        return photoRepo.save(photo);
    }

    @Override
    public List<RestorationPhoto> listPhotos(String projectId) {
        getById(projectId);
        return photoRepo.findByProjectIdOrderByCreatedAtDesc(projectId);
    }

    @Override
    public List<RestorationPhoto> listPhotosByStage(String projectId, String stage) {
        getById(projectId);
        return photoRepo.findByProjectIdAndStageOrderByCreatedAtDesc(projectId, stage);
    }

    @Override
    public void removePhoto(String photoId) {
        photoRepo.deleteById(photoId);
    }

    @Override
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", projectRepo.count());
        Arrays.stream(ProjectStatus.values()).forEach(s ->
                stats.put("count_" + s.name(), projectRepo.countByStatusAndDeletedFalse(s)));

        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        stats.put("newThisMonth", projectRepo.countByCreatedAtBetween(monthStart, LocalDateTime.now()));

        List<RestorationProject> ongoing = projectRepo.findByStatusInAndDeletedFalse(
                List.of(ProjectStatus.IN_PROGRESS, ProjectStatus.PAUSED));
        BigDecimal totalBudget = ongoing.stream()
                .map(RestorationProject::getBudget).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalActual = ongoing.stream()
                .map(RestorationProject::getActualCost).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        stats.put("totalBudget", totalBudget);
        stats.put("totalActualCost", totalActual);
        stats.put("ongoingCount", ongoing.size());

        double avgProgress = ongoing.stream().mapToInt(p -> p.getProgress() == null ? 0 : p.getProgress()).average().orElse(0);
        stats.put("avgProgress", Math.round(avgProgress * 10.0) / 10.0);

        return stats;
    }
}
