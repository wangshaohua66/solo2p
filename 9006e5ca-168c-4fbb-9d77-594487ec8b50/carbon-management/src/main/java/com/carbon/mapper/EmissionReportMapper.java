package com.carbon.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.carbon.entity.EmissionReport;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;

@Mapper
public interface EmissionReportMapper extends BaseMapper<EmissionReport> {

    BigDecimal sumEmissionByEnterpriseAndYear(@Param("enterpriseId") Long enterpriseId,
                                              @Param("reportYear") Integer reportYear);

    int batchInsert(@Param("list") List<EmissionReport> list);
}
