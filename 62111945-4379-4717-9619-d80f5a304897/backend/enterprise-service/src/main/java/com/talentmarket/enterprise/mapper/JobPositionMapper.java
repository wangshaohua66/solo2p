package com.talentmarket.enterprise.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.talentmarket.enterprise.entity.JobPosition;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface JobPositionMapper extends BaseMapper<JobPosition> {

    IPage<JobPosition> selectPositionList(Page<JobPosition> page,
                                         @Param("keyword") String keyword,
                                         @Param("city") String city,
                                         @Param("industry") String industry,
                                         @Param("experience") String experience,
                                         @Param("education") String education,
                                         @Param("salaryMin") Integer salaryMin,
                                         @Param("salaryMax") Integer salaryMax,
                                         @Param("enterpriseId") Long enterpriseId,
                                         @Param("status") Integer status);

    List<JobPosition> selectRecommendPositions(@Param("city") String city,
                                                @Param("skillTags") List<String> skillTags,
                                                @Param("limit") Integer limit);

    Integer countMatchedCandidates(@Param("city") String city,
                                   @Param("education") String education,
                                   @Param("experience") String experience);
}
