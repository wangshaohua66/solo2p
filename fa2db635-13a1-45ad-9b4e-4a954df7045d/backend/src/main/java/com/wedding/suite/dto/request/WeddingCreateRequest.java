package com.wedding.suite.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

@Data
public class WeddingCreateRequest {
    @NotBlank(message = "新人姓名不能为空")
    private String coupleName;

    private String groomName;
    private String brideName;

    @NotBlank(message = "联系电话不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;

    @NotBlank(message = "婚期不能为空")
    private String weddingDate;

    @NotNull(message = "桌数不能为空")
    @Min(value = 1, message = "桌数至少1桌")
    @Max(value = 200, message = "桌数不能超过200桌")
    private Integer guests;

    @NotNull(message = "门店不能为空")
    @Positive(message = "门店ID必须为正数")
    private Long storeId;

    @NotNull(message = "套餐不能为空")
    @Positive(message = "套餐ID必须为正数")
    private Long packageId;

    @Positive(message = "策划师ID必须为正数")
    private Long plannerId;

    private Long quoteTotal;

    @Valid
    private List<WeddingResourceItem> resources;
}
