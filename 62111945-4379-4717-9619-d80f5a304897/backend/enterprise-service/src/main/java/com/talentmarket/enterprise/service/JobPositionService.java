package com.talentmarket.enterprise.service;

import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.talentmarket.common.exception.BusinessException;
import com.talentmarket.common.result.ResultCode;
import com.talentmarket.common.utils.MatchAlgorithmUtils;
import com.talentmarket.common.utils.RedisUtils;
import com.talentmarket.enterprise.entity.Enterprise;
import com.talentmarket.enterprise.entity.JobPosition;
import com.talentmarket.enterprise.mapper.JobPositionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobPositionService {

    private final JobPositionMapper jobPositionMapper;
    private final EnterpriseService enterpriseService;
    private final SensitiveWordService sensitiveWordService;
    private final MatchAlgorithmUtils matchAlgorithmUtils;
    private final RedisUtils redisUtils;

    private static final String POSITION_CACHE_KEY = "position:";
    private static final String HOT_POSITIONS_KEY = "hot:positions:";
    private static final long CACHE_EXPIRE = 1800;

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

    @Transactional(rollbackFor = Exception.class)
    public JobPosition publish(JobPosition position) {
        if (!enterpriseService.checkEnterpriseVerified(position.getEnterpriseId())) {
            throw new BusinessException(ResultCode.ENTERPRISE_NOT_APPROVED);
        }

        sensitiveWordService.checkAndThrow(position.getPositionDescription(), "职位描述");
        sensitiveWordService.checkAndThrow(position.getRequirements(), "任职要求");

        position.setStatus(1);
        position.setAuditStatus(1);
        position.setViewCount(0);
        position.setApplyCount(0);

        extractSkillTags(position);

        jobPositionMapper.insert(position);
        log.info("岗位发布成功，岗位ID: {}, 岗位名称: {}", position.getId(), position.getPositionName());

        return position;
    }

    private void extractSkillTags(JobPosition position) {
        if (position.getSkillTags() == null || position.getSkillTags().isEmpty()) {
            List<String> tags = new ArrayList<>();
            String desc = position.getPositionDescription() + " " + position.getRequirements();
            
            String[] commonSkills = {
                "Java", "Python", "C++", "JavaScript", "TypeScript", "React", "Vue",
                "Spring", "MySQL", "Redis", "MongoDB", "Docker", "Kubernetes",
                "Linux", "Git", "Hadoop", "Spark", "数据分析", "算法"
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
            sensitiveWordService.checkAndThrow(position.getPositionDescription(), "职位描述");
        }
        if (position.getRequirements() != null) {
            sensitiveWordService.checkAndThrow(position.getRequirements(), "任职要求");
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
            log.info("岗位审核完成，岗位ID: {}, 结果: {}", id, passed ? "通过" : "不通过");
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
}
