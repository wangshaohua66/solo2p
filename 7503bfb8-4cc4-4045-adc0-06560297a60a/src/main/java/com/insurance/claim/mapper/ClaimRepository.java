package com.insurance.claim.mapper;

import com.insurance.claim.dto.request.ClaimQueryRequest;
import com.insurance.claim.entity.Claim;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface ClaimRepository {

    int insert(Claim claim);

    int updateById(Claim claim);

    int updateStatus(@Param("id") Long id, @Param("status") Integer status, @Param("version") Integer version);

    Claim selectById(@Param("id") Long id);

    Claim selectByClaimNo(@Param("claimNo") String claimNo);

    List<Claim> selectList(ClaimQueryRequest query);

    Long selectCount(ClaimQueryRequest query);

    List<Claim> selectByPolicyNo(@Param("policyNo") String policyNo);

    List<Claim> selectByReporterIdCard(@Param("reporterIdCard") String reporterIdCard);

    Integer countClaimsByIdCardAndDays(@Param("idCard") String idCard, @Param("days") Integer days);

    Integer countAccidentByIdCard(@Param("idCard") String idCard);

    int updateFraudInfo(@Param("id") Long id, @Param("fraudScore") Integer fraudScore,
                        @Param("fraudFlags") String fraudFlags, @Param("fraudSuspicious") Boolean fraudSuspicious);

    int updatePaymentAmount(@Param("id") Long id, @Param("paidAmount") java.math.BigDecimal paidAmount,
                            @Param("status") Integer status);

    int closeClaim(@Param("id") Long id, @Param("closedAt") java.time.LocalDateTime closedAt);

    int cancelClaim(@Param("id") Long id, @Param("remark") String remark);
}
