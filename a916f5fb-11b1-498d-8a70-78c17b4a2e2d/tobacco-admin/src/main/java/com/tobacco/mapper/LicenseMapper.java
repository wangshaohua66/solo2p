package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.entity.License;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Mapper
public interface LicenseMapper extends BaseMapper<License> {

    @Select("SELECT * FROM license WHERE license_no = #{licenseNo} AND deleted = 0")
    License selectByLicenseNo(@Param("licenseNo") String licenseNo);

    @Select("SELECT * FROM license WHERE retailer_id = #{retailerId} AND deleted = 0 ORDER BY create_time DESC LIMIT 1")
    License selectLatestByRetailerId(@Param("retailerId") Long retailerId);

    @Select("SELECT COUNT(*) FROM license " +
            "WHERE business_type = #{businessType} " +
            "AND status = #{status} " +
            "AND deleted = 0 " +
            "AND county = #{county} " +
            "AND ST_Distance_Sphere(point(longitude, latitude), point(#{longitude}, #{latitude})) < #{distance}")
    Integer countNearbyLicenses(@Param("businessType") String businessType,
                                 @Param("status") Integer status,
                                 @Param("longitude") BigDecimal longitude,
                                 @Param("latitude") BigDecimal latitude,
                                 @Param("distance") Double distance,
                                 @Param("county") String county);

    @Select("SELECT * FROM license WHERE expire_date BETWEEN #{startDate} AND #{endDate} AND status = #{status} AND deleted = 0")
    List<License> selectExpiringLicenses(@Param("startDate") LocalDate startDate,
                                          @Param("endDate") LocalDate endDate,
                                          @Param("status") Integer status);

    IPage<License> selectPageByCondition(Page<License> page,
                                          @Param("status") Integer status,
                                          @Param("countyId") Long countyId,
                                          @Param("stationId") Long stationId,
                                          @Param("businessType") String businessType,
                                          @Param("keyword") String keyword);
}
