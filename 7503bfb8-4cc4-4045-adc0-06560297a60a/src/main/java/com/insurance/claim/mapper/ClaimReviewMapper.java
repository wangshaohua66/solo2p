package com.insurance.claim.mapper;

import com.insurance.claim.entity.ClaimReview;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface ClaimReviewMapper {

    int insert(ClaimReview review);

    int updateById(ClaimReview review);

    ClaimReview selectById(@Param("id") Long id);

    List<ClaimReview> selectByClaimId(@Param("claimId") Long claimId);

    List<ClaimReview> selectByReviewerId(@Param("reviewerId") Long reviewerId, @Param("status") Integer status);

    ClaimReview selectLatestByClaimId(@Param("claimId") Long claimId);
}
