package com.talentmarket.recruitment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.talentmarket.recruitment.entity.FairBooth;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface FairBoothMapper extends BaseMapper<FairBooth> {

    List<FairBooth> selectByFairId(@Param("fairId") Long fairId);

    int batchInsert(@Param("list") List<FairBooth> list);
}
