package com.iccert.sample.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.iccert.sample.entity.SampleInfo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface SampleInfoMapper extends BaseMapper<SampleInfo> {

    @Select("SELECT * FROM sample_info WHERE retention_expire_date <= #{date} " +
            "AND sample_status != 'DESTROYED' AND is_deleted = 0")
    List<SampleInfo> selectExpiredRetentionSamples(@Param("date") LocalDate date);

    @Select("SELECT * FROM sample_info WHERE retention_expire_date BETWEEN #{start} AND #{end} " +
            "AND sample_status != 'DESTROYED' AND is_deleted = 0")
    List<SampleInfo> selectExpiringRetentionSamples(@Param("start") LocalDate start, @Param("end") LocalDate end);
}
