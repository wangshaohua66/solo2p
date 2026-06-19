package com.talentmarket.enterprise.controller;

import com.talentmarket.common.result.PageResult;
import com.talentmarket.common.result.Result;
import com.talentmarket.enterprise.entity.JobPosition;
import com.talentmarket.enterprise.service.JobPositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/position")
@RequiredArgsConstructor
public class JobPositionController {

    private final JobPositionService jobPositionService;

    @GetMapping("/{id}")
    public Result<JobPosition> getById(@PathVariable Long id) {
        jobPositionService.incrementViewCount(id);
        return Result.success(jobPositionService.getById(id));
    }

    @GetMapping("/list")
    public Result<PageResult<JobPosition>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) String experience,
            @RequestParam(required = false) String education,
            @RequestParam(required = false) Integer salaryMin,
            @RequestParam(required = false) Integer salaryMax) {
        var pageResult = jobPositionService.list(page, pageSize, keyword, city, industry,
                experience, education, salaryMin, salaryMax);
        return Result.success(PageResult.of(
                pageResult.getRecords(), pageResult.getTotal(), page, pageSize));
    }

    @GetMapping("/enterprise/{enterpriseId}")
    public Result<PageResult<JobPosition>> listByEnterprise(
            @PathVariable Long enterpriseId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) Integer status) {
        var pageResult = jobPositionService.listByEnterprise(enterpriseId, page, pageSize, status);
        return Result.success(PageResult.of(
                pageResult.getRecords(), pageResult.getTotal(), page, pageSize));
    }

    @PostMapping
    public Result<JobPosition> publish(@RequestBody JobPosition position) {
        return Result.success(jobPositionService.publish(position));
    }

    @PutMapping
    public Result<Boolean> update(@RequestBody JobPosition position) {
        return Result.success(jobPositionService.update(position));
    }

    @PostMapping("/audit/{id}")
    public Result<Boolean> audit(@PathVariable Long id,
                                  @RequestParam boolean passed,
                                  @RequestParam(required = false) String remark) {
        return Result.success(jobPositionService.audit(id, passed, remark));
    }

    @GetMapping("/recommend")
    public Result<List<JobPosition>> recommend(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) List<String> skills,
            @RequestParam(defaultValue = "10") int limit) {
        return Result.success(jobPositionService.getRecommendPositions(city, skills, limit));
    }

    @GetMapping("/match-score/{id}")
    public Result<Double> matchScore(@PathVariable Long id,
                                    @RequestParam(required = false) List<String> skills,
                                    @RequestParam(defaultValue = "0") int expectedSalaryMin,
                                    @RequestParam(defaultValue = "0") int expectedSalaryMax,
                                    @RequestParam(required = false) String preferredLocation,
                                    @RequestParam(defaultValue = "0") int yearsOfExperience,
                                    @RequestParam(required = false) String highestEducation) {
        JobPosition position = jobPositionService.getById(id);
        if (position == null) {
            return Result.fail("岗位不存在");
        }
        double score = jobPositionService.calculateMatchScore(position, skills,
                expectedSalaryMin, expectedSalaryMax, preferredLocation,
                yearsOfExperience, highestEducation);
        return Result.success(score);
    }
}
