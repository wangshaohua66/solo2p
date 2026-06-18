package com.insurance.claim.mapper;

import com.insurance.claim.entity.Survey;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface SurveyMapper {

    int insert(Survey survey);

    int updateById(Survey survey);

    Survey selectById(@Param("id") Long id);

    Survey selectByClaimId(@Param("claimId") Long claimId);

    List<Survey> selectBySurveyorId(@Param("surveyorId") Long surveyorId, @Param("status") Integer status);

    List<Survey> selectPendingSurveys();

    int assignSurveyor(@Param("id") Long id, @Param("surveyorId") Long surveyorId,
                       @Param("surveyorName") String surveyorName, @Param("assignedAt") java.time.LocalDateTime assignedAt);
}
