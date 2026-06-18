package com.insurance.claim.mapper;

import com.insurance.claim.entity.ClaimDocument;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface ClaimDocumentMapper {

    int insert(ClaimDocument document);

    int batchInsert(@Param("list") List<ClaimDocument> documents);

    int updateById(ClaimDocument document);

    ClaimDocument selectById(@Param("id") Long id);

    List<ClaimDocument> selectByClaimId(@Param("claimId") Long claimId);

    List<ClaimDocument> selectByClaimIdAndType(@Param("claimId") Long claimId, @Param("documentType") Integer documentType);

    List<ClaimDocument> selectByBusiness(@Param("businessId") Long businessId, @Param("businessType") String businessType);

    int deleteByClaimId(@Param("claimId") Long claimId);
}
