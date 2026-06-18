package com.insurance.claim.mapper;

import com.insurance.claim.entity.ClaimParty;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface ClaimPartyMapper {

    int insert(ClaimParty party);

    int batchInsert(@Param("list") List<ClaimParty> parties);

    int updateById(ClaimParty party);

    ClaimParty selectById(@Param("id") Long id);

    List<ClaimParty> selectByClaimId(@Param("claimId") Long claimId);

    int deleteByClaimId(@Param("claimId") Long claimId);
}
