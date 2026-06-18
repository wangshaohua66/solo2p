package com.insurance.claim.mapper;

import com.insurance.claim.entity.LossAssessment;
import com.insurance.claim.entity.LossItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface LossAssessmentMapper {

    int insertAssessment(LossAssessment assessment);

    int updateAssessment(LossAssessment assessment);

    LossAssessment selectById(@Param("id") Long id);

    LossAssessment selectByClaimId(@Param("claimId") Long claimId);

    List<LossAssessment> selectByAssessorId(@Param("assessorId") Long assessorId);

    int insertLossItem(LossItem lossItem);

    int batchInsertLossItems(@Param("list") List<LossItem> lossItems);

    List<LossItem> selectLossItemsByAssessmentId(@Param("assessmentId") Long assessmentId);

    int updateLossItem(LossItem lossItem);

    int deleteLossItemsByAssessmentId(@Param("assessmentId") Long assessmentId);
}
