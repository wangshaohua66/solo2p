package com.talentmarket.jobseeker.service;

import com.talentmarket.common.exception.BusinessException;
import com.talentmarket.common.result.ResultCode;
import com.talentmarket.common.utils.ResumeParserUtils;
import com.talentmarket.jobseeker.entity.Resume;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeParserService {

    private final ResumeParserUtils resumeParserUtils;

    public ResumeParserUtils.ParsedResume parseResumeFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ResultCode.PARAM_ERROR.getCode(), "请上传简历文件");
        }

        String fileName = file.getOriginalFilename();
        if (fileName == null) {
            throw new BusinessException(ResultCode.PARAM_ERROR.getCode(), "文件名不能为空");
        }

        String lowerFileName = fileName.toLowerCase();
        if (!lowerFileName.endsWith(".pdf") && !lowerFileName.endsWith(".doc") && !lowerFileName.endsWith(".docx")) {
            throw new BusinessException(ResultCode.FILE_FORMAT_ERROR.getCode(), "仅支持PDF、DOC、DOCX格式的简历文件");
        }

        try {
            ResumeParserUtils.ParsedResume parsedResume = resumeParserUtils.parseResume(file);
            log.info("简历解析成功，文件名: {}, 解析到姓名: {}, 技能数: {}",
                    fileName, parsedResume.getName(),
                    parsedResume.getSkills() != null ? parsedResume.getSkills().size() : 0);
            return parsedResume;
        } catch (IOException e) {
            log.error("简历解析失败，文件名: {}", fileName, e);
            throw new BusinessException(ResultCode.FILE_UPLOAD_FAILED.getCode(), "简历解析失败，请检查文件格式");
        }
    }

    public Resume convertToResume(ResumeParserUtils.ParsedResume parsedResume) {
        Resume resume = new Resume();

        resume.setName(parsedResume.getName());
        resume.setPhone(parsedResume.getPhone());
        resume.setEmail(parsedResume.getEmail());
        resume.setAge(parsedResume.getAge());
        resume.setGender(parsedResume.getGender());
        resume.setHighestEducation(parsedResume.getEducation());
        resume.setExpectedPosition(parsedResume.getExpectedPosition());
        resume.setExpectedSalaryMin(parsedResume.getExpectedSalaryMin());
        resume.setExpectedSalaryMax(parsedResume.getExpectedSalaryMax());
        resume.setYearsOfExperience(parsedResume.getYearsOfExperience());

        if (parsedResume.getSkills() != null && !parsedResume.getSkills().isEmpty()) {
            resume.setSkills(parsedResume.getSkills());
            resume.setSkillTags(String.join(",", parsedResume.getSkills()));
        }

        return resume;
    }

    public Resume parseAndCreateResume(Long jobseekerId, MultipartFile file) {
        ResumeParserUtils.ParsedResume parsedResume = parseResumeFile(file);
        Resume resume = convertToResume(parsedResume);
        resume.setJobseekerId(jobseekerId);
        resume.setResumeTitle(file.getOriginalFilename() + "（自动解析）");
        resume.setIsDefault(0);
        resume.setPrivacy(0);
        resume.setStatus(1);
        return resume;
    }

    public int calculateCompleteRate(Resume resume) {
        int score = 0;
        int total = 10;

        if (resume.getName() != null && !resume.getName().isEmpty()) score++;
        if (resume.getPhone() != null && !resume.getPhone().isEmpty()) score++;
        if (resume.getEmail() != null && !resume.getEmail().isEmpty()) score++;
        if (resume.getHighestEducation() != null && !resume.getHighestEducation().isEmpty()) score++;
        if (resume.getYearsOfExperience() != null) score++;
        if (resume.getExpectedPosition() != null && !resume.getExpectedPosition().isEmpty()) score++;
        if (resume.getExpectedSalaryMin() != null && resume.getExpectedSalaryMax() != null) score++;
        if (resume.getExpectedCity() != null && !resume.getExpectedCity().isEmpty()) score++;
        if (resume.getSkills() != null && resume.getSkills().size() > 0) score++;
        if (resume.getSelfIntroduction() != null && !resume.getSelfIntroduction().isEmpty()) score++;

        return (int) ((double) score / total * 100);
    }
}
