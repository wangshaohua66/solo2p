package com.insurance.claim.mapper;

import com.insurance.claim.entity.PartPriceGuide;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.math.BigDecimal;
import java.util.List;

@Mapper
public interface PartPriceGuideRepository {

    PartPriceGuide selectById(@Param("id") Long id);

    List<PartPriceGuide> selectByPartCode(@Param("partCode") String partCode,
                                           @Param("province") String province,
                                           @Param("city") String city);

    PartPriceGuide matchGuidePrice(@Param("partCode") String partCode,
                                    @Param("partName") String partName,
                                    @Param("vehicleBrand") String vehicleBrand,
                                    @Param("vehicleModel") String vehicleModel,
                                    @Param("province") String province,
                                    @Param("city") String city);

    List<PartPriceGuide> selectByVehicleAndRegion(@Param("vehicleBrand") String vehicleBrand,
                                                   @Param("vehicleModel") String vehicleModel,
                                                   @Param("regionCode") String regionCode);

    BigDecimal getAveragePrice(@Param("partCode") String partCode,
                                @Param("province") String province,
                                @Param("city") String city);

    int insert(PartPriceGuide guide);

    int updateById(PartPriceGuide guide);

    int batchInsert(@Param("list") List<PartPriceGuide> list);
}
