package com.insurance.claim.mapper;

import com.insurance.claim.entity.Policy;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface PolicyMapper {

    Policy selectById(@Param("id") Long id);

    Policy selectByPolicyNo(@Param("policyNo") String policyNo);

    List<Policy> selectByInsuredIdCard(@Param("insuredIdCard") String insuredIdCard);

    List<Policy> selectByVehiclePlateNo(@Param("vehiclePlateNo") String vehiclePlateNo);

    int updateClaimCount(@Param("id") Long id, @Param("claimCount") Integer claimCount,
                         @Param("totalClaimAmount") java.math.BigDecimal totalClaimAmount);

    int insert(Policy policy);

    int updateById(Policy policy);
}
