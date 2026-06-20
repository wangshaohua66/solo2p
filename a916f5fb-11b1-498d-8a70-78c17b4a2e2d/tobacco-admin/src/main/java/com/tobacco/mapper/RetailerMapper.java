package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.entity.Retailer;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface RetailerMapper extends BaseMapper<Retailer> {

    @Select("SELECT * FROM retailer WHERE user_id = #{userId} AND deleted = 0")
    Retailer selectByUserId(@Param("userId") Long userId);

    @Select("SELECT * FROM retailer WHERE license_no = #{licenseNo} AND deleted = 0")
    Retailer selectByLicenseNo(@Param("licenseNo") String licenseNo);

    IPage<Retailer> selectPageByCondition(Page<Retailer> page,
                                           @Param("countyId") Long countyId,
                                           @Param("stationId") Long stationId,
                                           @Param("creditLevel") String creditLevel,
                                           @Param("tier") Integer tier,
                                           @Param("keyword") String keyword);
}
