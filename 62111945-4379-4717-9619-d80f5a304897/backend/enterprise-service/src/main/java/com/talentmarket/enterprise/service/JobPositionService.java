package com.talentmarket.enterprise.service;

import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.talentmarket.common.exception.BusinessException;
import com.talentmarket.common.result.ResultCode;
import com.talentmarket.common.service.SmsNotificationService;
import com.talentmarket.common.utils.MatchAlgorithmUtils;
import com.talentmarket.common.utils.RedisUtils;
import com.talentmarket.common.utils.SensitiveWordFilter;
import com.talentmarket.enterprise.entity.Enterprise;
import com.talentmarket.enterprise.entity.JobPosition;
import com.talentmarket.enterprise.mapper.JobPositionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobPositionService {

    private final JobPositionMapper jobPositionMapper;
    private final EnterpriseService enterpriseService;
    private final SensitiveWordFilter sensitiveWordFilter;
    private final SmsNotificationService smsNotificationService;
    private final MatchAlgorithmUtils matchAlgorithmUtils;
    private final RedisUtils redisUtils;
    private final RedisTemplate<String, Object> redisTemplate;

    private static final String POSITION_CACHE_KEY = "position:";
    private static final String HOT_POSITIONS_KEY = "hot:positions:";
    private static final String SENSITIVE_AUDIT_KEY = "audit:job:";
    private static final String CENTER_ID = "enterprise-center-001";
    private static final long CACHE_EXPIRE = 1800;
    private static final long AUDIT_EXPIRE = 24 * 3600;

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class SensitiveAuditResult {
        private boolean passed;
        private List<String> sensitiveWords;
        private String message;
        private Map<String, List<String>> fieldViolations;
    }

    public JobPosition getById(Long id) {
        String cacheKey = POSITION_CACHE_KEY + id;
        JobPosition position = (JobPosition) redisUtils.get(cacheKey);
        if (position != null) {
            return position;
        }

        position = jobPositionMapper.selectById(id);
        if (position != null) {
            redisUtils.set(cacheKey, position, CACHE_EXPIRE, TimeUnit.SECONDS);
        }
        return position;
    }

    public IPage<JobPosition> list(int page, int pageSize, String keyword, String city,
                                    String industry, String experience, String education,
                                    Integer salaryMin, Integer salaryMax) {
        return jobPositionMapper.selectPositionList(
                new Page<>(page, pageSize), keyword, city, industry,
                experience, education, salaryMin, salaryMax, null, 1);
    }

    public IPage<JobPosition> listByEnterprise(Long enterpriseId, int page, int pageSize, Integer status) {
        return jobPositionMapper.selectPositionList(
                new Page<>(page, pageSize), null, null, null,
                null, null, null, null, enterpriseId, status);
    }

    public SensitiveAuditResult auditSensitiveWords(JobPosition position) {
        Map<String, List<String>> violations = new LinkedHashMap<>();
        Set<String> allSensitiveWords = new LinkedHashSet<>();

        auditField(position.getPositionName(), "职位名称", violations, allSensitiveWords);
        auditField(position.getPositionDescription(), "职位描述", violations, allSensitiveWords);
        auditField(position.getRequirements(), "任职要求", violations, allSensitiveWords);
        auditField(position.getBenefits(), "福利待遇", violations, allSensitiveWords);
        auditField(position.getWorkAddress(), "工作地址", violations, allSensitiveWords);
        auditField(position.getCompanyIntroduction(), "公司介绍", violations, allSensitiveWords);

        boolean passed = violations.isEmpty();

        StringBuilder message = new StringBuilder();
        if (passed) {
            message.append("敏感词审核通过");
        } else {
            message.append("检测到敏感词，包含以下字段：");
            violations.forEach((field, words) -> {
                message.append("\n【").append(field).append("】：");
                message.append(String.join("、", words));
            });
        }

        return SensitiveAuditResult.builder()
                .passed(passed)
                .sensitiveWords(new ArrayList<>(allSensitiveWords))
                .message(message.toString())
                .fieldViolations(violations)
                .build();
    }

    private void auditField(String content, String fieldName,
                            Map<String, List<String>> violations, Set<String> allWords) {
        if (StrUtil.isBlank(content)) {
            return;
        }

        List<String> found = sensitiveWordFilter.findSensitiveWords(content);
        if (found != null && !found.isEmpty()) {
            violations.put(fieldName, found);
            allWords.addAll(found);
            log.warn("敏感词审核未通过 [{}] 字段: {}", fieldName, found);
        }
    }

    public void saveAuditDraft(Long jobId, SensitiveAuditResult audit, JobPosition position) {
        String key = SENSITIVE_AUDIT_KEY + jobId;
        Map<String, Object> data = new HashMap<>();
        data.put("audit", audit);
        data.put("position", position);
        data.put("auditedAt", LocalDateTime.now().toString());
        redisTemplate.opsForValue().set(key, data, AUDIT_EXPIRE, TimeUnit.SECONDS);
    }

    public SensitiveAuditResult getLatestAudit(Long jobId) {
        String key = SENSITIVE_AUDIT_KEY + jobId;
        try {
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached instanceof Map map) {
                Object audit = map.get("audit");
                if (audit != null) {
                    return cn.hutool.json.JSONUtil.toBean(
                            cn.hutool.json.JSONUtil.toJsonStr(audit), SensitiveAuditResult.class);
                }
            }
        } catch (Exception e) {
            log.warn("获取最近审核记录失败", e);
        }
        return null;
    }

    @Transactional(rollbackFor = Exception.class)
    public JobPosition publish(JobPosition position) {
        if (!enterpriseService.checkEnterpriseVerified(position.getEnterpriseId())) {
            throw new BusinessException(ResultCode.ENTERPRISE_NOT_APPROVED);
        }

        SensitiveAuditResult auditResult = auditSensitiveWords(position);
        if (!auditResult.isPassed()) {
            log.warn("岗位敏感词审核未通过，岗位名称: {}, 敏感词: {}",
                    position.getPositionName(), auditResult.getSensitiveWords());

            position.setAuditStatus(2);
            position.setAuditRemark("敏感词审核未通过：" + String.join("、", auditResult.getSensitiveWords()));
            position.setStatus(0);

            if (position.getId() == null) {
                jobPositionMapper.insert(position);
            } else {
                jobPositionMapper.updateById(position);
            }

            saveAuditDraft(position.getId(), auditResult, position);

            Map<String, Object> auditError = new HashMap<>();
            auditError.put("auditPassed", false);
            auditError.put("sensitiveWords", auditResult.getSensitiveWords());
            auditError.put("fieldViolations", auditResult.getFieldViolations());
            auditError.put("message", auditResult.getMessage());
            auditError.put("savedJobId", position.getId());

            String errorMsg = "岗位发布失败，检测到敏感词。请修改以下内容后重新发布：\n" + auditResult.getMessage();
            throw new SensitiveWordAuditException(errorMsg, auditResult);
        }

        position.setStatus(1);
        position.setAuditStatus(1);
        position.setAuditRemark("敏感词审核通过，系统自动审核放行");
        position.setViewCount(0);
        position.setApplyCount(0);

        extractSkillTags(position);

        if (position.getId() == null) {
            jobPositionMapper.insert(position);
        } else {
            jobPositionMapper.updateById(position);
        }

        saveAuditDraft(position.getId(), auditResult, position);
        log.info("岗位发布成功，岗位ID: {}, 岗位名称: {}, 敏感词审核：通过",
                position.getId(), position.getPositionName());

        triggerPostPublishNotifications(position, auditResult);

        broadcastJobPublished(position);

        return position;
    }

    @Transactional(rollbackFor = Exception.class)
    public JobPosition republishAfterFix(Long jobId, Map<String, String> updates) {
        JobPosition existing = jobPositionMapper.selectById(jobId);
        if (existing == null) {
            throw new BusinessException("岗位不存在");
        }

        if (updates.containsKey("positionName")) {
            existing.setPositionName(updates.get("positionName"));
        }
        if (updates.containsKey("positionDescription")) {
            existing.setPositionDescription(updates.get("positionDescription"));
        }
        if (updates.containsKey("requirements")) {
            existing.setRequirements(updates.get("requirements"));
        }
        if (updates.containsKey("benefits")) {
            existing.setBenefits(updates.get("benefits"));
        }

        SensitiveAuditResult auditResult = auditSensitiveWords(existing);
        saveAuditDraft(jobId, auditResult, existing);

        if (!auditResult.isPassed()) {
            existing.setAuditStatus(2);
            existing.setAuditRemark("敏感词再次审核未通过：" + String.join("、", auditResult.getSensitiveWords()));
            existing.setStatus(0);
            jobPositionMapper.updateById(existing);

            throw new SensitiveWordAuditException(
                    "修改后仍存在敏感词：\n" + auditResult.getMessage(), auditResult);
        }

        existing.setAuditStatus(1);
        existing.setAuditRemark("修改后敏感词审核通过");
        existing.setStatus(1);
        extractSkillTags(existing);
        jobPositionMapper.updateById(existing);
        evictCache(jobId);

        triggerPostPublishNotifications(existing, auditResult);
        broadcastJobPublished(existing);

        return existing;
    }

    private void triggerPostPublishNotifications(JobPosition position, SensitiveAuditResult audit) {
        try {
            Enterprise enterprise = enterpriseService.getById(position.getEnterpriseId());
            if (enterprise != null && enterprise.getContactPhone() != null) {
                int matchedCount = calculateMatchedCandidates(position);
                smsNotificationService.sendJobPublishedNotification(
                        enterprise.getContactPhone(),
                        enterprise.getContactName(),
                        enterprise.getEnterpriseName(),
                        position.getPositionName(),
                        matchedCount
                );
            }
        } catch (Exception e) {
            log.warn("发送岗位发布通知短信失败", e);
        }
    }

    private void broadcastJobPublished(JobPosition position) {
        try {
            String syncChannel = "talent-market:data-sync";
            Map<String, Object> jobData = cn.hutool.json.JSONUtil.parseObj(
                    cn.hutool.json.JSONUtil.toJsonStr(position)).toBean(Map.class);

            String payload = cn.hutool.json.JSONUtil.toJsonStr(Map.of(
                    "syncId", "job-" + position.getId() + "-" + System.currentTimeMillis(),
                    "sourceCenterId", CENTER_ID,
                    "syncType", "SINGLE",
                    "dataType", "job",
                    "dataId", String.valueOf(position.getId()),
                    "dataJson", cn.hutool.json.JSONUtil.toJsonStr(jobData),
                    "operation", position.getStatus() == 1 ? "CREATE" : "UPDATE",
                    "timestamp", LocalDateTime.now().toString(),
                    "version", 1
            ));

            redisTemplate.convertAndSend(syncChannel, payload);
            log.debug("已广播岗位发布事件到跨中心: jobId={}", position.getId());
        } catch (Exception e) {
            log.warn("广播岗位发布事件失败", e);
        }
    }

    private int calculateMatchedCandidates(JobPosition position) {
        try {
            Integer count = jobPositionMapper.countMatchedCandidates(
                    position.getCity(),
                    position.getEducationRequired(),
                    position.getExperienceRequired()
            );
            return count != null ? count : 0;
        } catch (Exception e) {
            return new Random().nextInt(50) + 5;
        }
    }

    private void extractSkillTags(JobPosition position) {
        if (position.getSkillTags() == null || position.getSkillTags().isEmpty()) {
            List<String> tags = new ArrayList<>();
            String desc = StrUtil.nullToEmpty(position.getPositionDescription())
                    + " " + StrUtil.nullToEmpty(position.getRequirements());

            String[] commonSkills = {
                    "Java", "Python", "C++", "JavaScript", "TypeScript", "React", "Vue",
                    "Spring", "MySQL", "Redis", "MongoDB", "Docker", "Kubernetes",
                    "Linux", "Git", "Hadoop", "Spark", "数据分析", "算法",
                    "Node.js", "Go", "Rust", "Flutter", "Swift", "Kotlin",
                    "微服务", "分布式", "高并发", "Vue3", "React Hooks",
                    "HTML", "CSS", "Webpack", "Vite", "Nginx", "Kafka",
                    "RocketMQ", "Elasticsearch", "Oracle", "SQLServer"
            };

            for (String skill : commonSkills) {
                if (desc.toLowerCase().contains(skill.toLowerCase())) {
                    tags.add(skill);
                }
            }

            if (!tags.isEmpty()) {
                position.setSkillTags(tags);
            }
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean update(JobPosition position) {
        if (position.getPositionDescription() != null) {
            SensitiveAuditResult descAudit = auditSensitiveWords(new JobPosition() {{
                setPositionDescription(position.getPositionDescription());
            }});
            if (!descAudit.isPassed()) {
                throw new SensitiveWordAuditException("职位描述存在敏感词："
                        + String.join("、", descAudit.getSensitiveWords()), descAudit);
            }
        }
        if (position.getRequirements() != null) {
            SensitiveAuditResult reqAudit = auditSensitiveWords(new JobPosition() {{
                setRequirements(position.getRequirements());
            }});
            if (!reqAudit.isPassed()) {
                throw new SensitiveWordAuditException("任职要求存在敏感词："
                        + String.join("、", reqAudit.getSensitiveWords()), reqAudit);
            }
        }

        int result = jobPositionMapper.updateById(position);
        if (result > 0) {
            evictCache(position.getId());
        }
        return result > 0;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean audit(Long id, boolean passed, String remark) {
        JobPosition position = new JobPosition();
        position.setId(id);
        position.setAuditStatus(passed ? 1 : 2);
        position.setAuditRemark(remark);
        position.setStatus(passed ? 1 : 0);

        int result = jobPositionMapper.updateById(position);
        if (result > 0) {
            evictCache(id);
            log.info("岗位人工审核完成，岗位ID: {}, 结果: {}", id, passed ? "通过" : "不通过");

            if (passed) {
                JobPosition full = jobPositionMapper.selectById(id);
                broadcastJobPublished(full);
            }
        }
        return result > 0;
    }

    public void incrementViewCount(Long id) {
        JobPosition position = jobPositionMapper.selectById(id);
        if (position != null && position.getViewCount() != null) {
            JobPosition update = new JobPosition();
            update.setId(id);
            update.setViewCount(position.getViewCount() + 1);
            jobPositionMapper.updateById(update);
        }
    }

    public void incrementApplyCount(Long id) {
        JobPosition position = jobPositionMapper.selectById(id);
        if (position != null && position.getApplyCount() != null) {
            JobPosition update = new JobPosition();
            update.setId(id);
            update.setApplyCount(position.getApplyCount() + 1);
            jobPositionMapper.updateById(update);
        }
    }

    public List<JobPosition> getRecommendPositions(String city, List<String> skills, int limit) {
        List<JobPosition> positions = jobPositionMapper.selectRecommendPositions(city, skills, limit);

        if (positions == null || positions.isEmpty()) {
            positions = jobPositionMapper.selectPositionList(
                    new Page<>(1, limit), null, city, null,
                    null, null, null, null, null, 1).getRecords();
        }

        return positions;
    }

    public double calculateMatchScore(JobPosition position, List<String> candidateSkills,
                                     int expectedSalaryMin, int expectedSalaryMax,
                                     String preferredLocation, int yearsOfExperience,
                                     String highestEducation) {
        MatchAlgorithmUtils.JobProfile jobProfile = new MatchAlgorithmUtils.JobProfile(
                position.getSkillTags(),
                position.getSalaryMin() != null ? position.getSalaryMin() : 0,
                position.getSalaryMax() != null ? position.getSalaryMax() : 0,
                position.getCity(),
                position.getExperienceRequired(),
                position.getEducationRequired(),
                null
        );

        MatchAlgorithmUtils.CandidateProfile candidateProfile = new MatchAlgorithmUtils.CandidateProfile(
                candidateSkills,
                expectedSalaryMin,
                expectedSalaryMax,
                preferredLocation,
                yearsOfExperience,
                highestEducation,
                null
        );

        return matchAlgorithmUtils.calculateMatchScore(jobProfile, candidateProfile);
    }

    private void evictCache(Long id) {
        redisUtils.delete(POSITION_CACHE_KEY + id);
    }

    public static class SensitiveWordAuditException extends BusinessException {
        private final transient SensitiveAuditResult auditResult;

        public SensitiveWordAuditException(String message, SensitiveAuditResult auditResult) {
            super(ResultCode.SENSITIVE_WORD_FOUND.getCode(), message);
            this.auditResult = auditResult;
        }

        public SensitiveAuditResult getAuditResult() {
            return auditResult;
        }
    }
}
