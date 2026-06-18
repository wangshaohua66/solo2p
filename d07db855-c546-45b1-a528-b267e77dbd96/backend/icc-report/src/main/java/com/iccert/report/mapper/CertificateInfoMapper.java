package com.iccert.report.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.iccert.report.entity.CertificateInfo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface CertificateInfoMapper extends BaseMapper<CertificateInfo> {

    @Select("SELECT * FROM certificate_info WHERE cert_status = 'VALID' " +
            "AND expire_date BETWEEN #{start} AND #{end} AND is_reminder_sent = 0 AND is_deleted = 0")
    List<CertificateInfo> selectExpiringCertificates(@Param("start") LocalDate start, @Param("end") LocalDate end);
}
