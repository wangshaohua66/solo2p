package com.wedding.suite.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

@Data
public class PricingCalcRequest {
    @NotNull(message = "套餐不能为空")
    @Positive(message = "套餐ID必须为正数")
    private Long packageId;

    @NotNull(message = "桌数不能为空")
    @Min(value = 1, message = "桌数至少1桌")
    private Integer guests;

    private List<@Positive Long> serviceIds;

    @Valid
    private List<AddonQtyRequest> addons;

    @NotNull(message = "门店不能为空")
    @Positive(message = "门店ID必须为正数")
    private Long storeId;
}
