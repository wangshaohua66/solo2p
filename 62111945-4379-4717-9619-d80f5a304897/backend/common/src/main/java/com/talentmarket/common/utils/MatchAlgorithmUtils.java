package com.talentmarket.common.utils;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class MatchAlgorithmUtils {

    private static final double SKILL_WEIGHT = 0.35;
    private static final double SALARY_WEIGHT = 0.20;
    private static final double LOCATION_WEIGHT = 0.15;
    private static final double EXPERIENCE_WEIGHT = 0.15;
    private static final double EDUCATION_WEIGHT = 0.10;
    private static final double INDUSTRY_WEIGHT = 0.05;

    @Data
    @AllArgsConstructor
    public static class JobProfile {
        private List<String> requiredSkills;
        private int salaryMin;
        private int salaryMax;
        private String location;
        private String experienceRequired;
        private String educationRequired;
        private String industry;
    }

    @Data
    @AllArgsConstructor
    public static class CandidateProfile {
        private List<String> skills;
        private int expectedSalaryMin;
        private int expectedSalaryMax;
        private String preferredLocation;
        private int yearsOfExperience;
        private String highestEducation;
        private String previousIndustry;
    }

    public double calculateMatchScore(JobProfile job, CandidateProfile candidate) {
        double skillScore = calculateSkillMatch(job.getRequiredSkills(), candidate.getSkills());
        double salaryScore = calculateSalaryMatch(
                job.getSalaryMin(), job.getSalaryMax(),
                candidate.getExpectedSalaryMin(), candidate.getExpectedSalaryMax()
        );
        double locationScore = calculateLocationMatch(job.getLocation(), candidate.getPreferredLocation());
        double experienceScore = calculateExperienceMatch(job.getExperienceRequired(), candidate.getYearsOfExperience());
        double educationScore = calculateEducationMatch(job.getEducationRequired(), candidate.getHighestEducation());
        double industryScore = calculateIndustryMatch(job.getIndustry(), candidate.getPreviousIndustry());

        double totalScore =
                skillScore * SKILL_WEIGHT +
                salaryScore * SALARY_WEIGHT +
                locationScore * LOCATION_WEIGHT +
                experienceScore * EXPERIENCE_WEIGHT +
                educationScore * EDUCATION_WEIGHT +
                industryScore * INDUSTRY_WEIGHT;

        log.debug("匹配度计算 - 技能:{}, 薪资:{}, 地点:{}, 经验:{}, 学历:{}, 行业:{}, 总分:{}",
                skillScore, salaryScore, locationScore, experienceScore, educationScore, industryScore, totalScore);

        return Math.round(totalScore * 100.0) / 100.0;
    }

    private double calculateSkillMatch(List<String> requiredSkills, List<String> candidateSkills) {
        if (requiredSkills == null || requiredSkills.isEmpty()) {
            return 1.0;
        }
        if (candidateSkills == null || candidateSkills.isEmpty()) {
            return 0.0;
        }

        Set<String> requiredSet = new HashSet<>(requiredSkills);
        Set<String> candidateSet = new HashSet<>(candidateSkills);

        int matchCount = 0;
        for (String skill : requiredSet) {
            for (String candidateSkill : candidateSet) {
                if (candidateSkill.toLowerCase().contains(skill.toLowerCase()) ||
                    skill.toLowerCase().contains(candidateSkill.toLowerCase())) {
                    matchCount++;
                    break;
                }
            }
        }

        return (double) matchCount / requiredSet.size();
    }

    private double calculateSalaryMatch(int jobMin, int jobMax, int candidateMin, int candidateMax) {
        if (jobMin <= 0 || jobMax <= 0 || candidateMin <= 0 || candidateMax <= 0) {
            return 0.5;
        }

        int overlapStart = Math.max(jobMin, candidateMin);
        int overlapEnd = Math.min(jobMax, candidateMax);

        if (overlapStart > overlapEnd) {
            double jobMid = (jobMin + jobMax) / 2.0;
            double candidateMid = (candidateMin + candidateMax) / 2.0;
            double diff = Math.abs(jobMid - candidateMid) / jobMid;
            return Math.max(0, 1 - diff);
        }

        int overlap = overlapEnd - overlapStart;
        int candidateRange = candidateMax - candidateMin;

        return (double) overlap / candidateRange;
    }

    private double calculateLocationMatch(String jobLocation, String candidateLocation) {
        if (jobLocation == null || candidateLocation == null) {
            return 0.5;
        }

        if (jobLocation.equals(candidateLocation)) {
            return 1.0;
        }

        String[] jobParts = jobLocation.split("[市区县]");
        String[] candidateParts = candidateLocation.split("[市区县]");

        if (jobParts.length > 0 && candidateParts.length > 0 &&
            jobParts[0].equals(candidateParts[0])) {
            return 0.7;
        }

        return 0.3;
    }

    private double calculateExperienceMatch(String required, int candidateYears) {
        if (required == null || required.isEmpty()) {
            return 1.0;
        }

        int requiredYears = parseExperienceYears(required);
        
        if (candidateYears >= requiredYears) {
            return Math.min(1.0, 0.8 + (candidateYears - requiredYears) * 0.05);
        } else {
            double diff = requiredYears - candidateYears;
            return Math.max(0, 1 - diff * 0.15);
        }
    }

    private int parseExperienceYears(String experience) {
        if (experience == null || experience.isEmpty()) {
            return 0;
        }
        if (experience.contains("不限")) return 0;
        if (experience.contains("应届")) return 0;
        if (experience.contains("1-3")) return 2;
        if (experience.contains("3-5")) return 4;
        if (experience.contains("5-10")) return 7;
        if (experience.contains("10")) return 10;
        return 0;
    }

    private double calculateEducationMatch(String required, String candidate) {
        if (required == null || required.isEmpty() || candidate == null || candidate.isEmpty()) {
            return 0.5;
        }

        Map<String, Integer> educationRank = new HashMap<>();
        educationRank.put("不限", 0);
        educationRank.put("大专", 2);
        educationRank.put("本科", 3);
        educationRank.put("硕士", 4);
        educationRank.put("博士", 5);

        int requiredLevel = educationRank.getOrDefault(required, 0);
        int candidateLevel = educationRank.getOrDefault(candidate, 0);

        if (candidateLevel >= requiredLevel) {
            return 1.0;
        } else {
            return Math.max(0, 1 - (requiredLevel - candidateLevel) * 0.25);
        }
    }

    private double calculateIndustryMatch(String jobIndustry, String candidateIndustry) {
        if (jobIndustry == null || candidateIndustry == null) {
            return 0.5;
        }
        return jobIndustry.equals(candidateIndustry) ? 1.0 : 0.3;
    }

    public List<String> getMatchDescription(JobProfile job, CandidateProfile candidate) {
        List<String> highlights = new ArrayList<>();
        
        double skillScore = calculateSkillMatch(job.getRequiredSkills(), candidate.getSkills());
        if (skillScore >= 0.8) {
            highlights.add("技能高度匹配");
        } else if (skillScore >= 0.6) {
            highlights.add("技能较为匹配");
        }

        double salaryScore = calculateSalaryMatch(
                job.getSalaryMin(), job.getSalaryMax(),
                candidate.getExpectedSalaryMin(), candidate.getExpectedSalaryMax()
        );
        if (salaryScore >= 0.8) {
            highlights.add("薪资预期匹配");
        }

        if (job.getLocation() != null && job.getLocation().equals(candidate.getPreferredLocation())) {
            highlights.add("地点匹配");
        }

        return highlights;
    }
}
