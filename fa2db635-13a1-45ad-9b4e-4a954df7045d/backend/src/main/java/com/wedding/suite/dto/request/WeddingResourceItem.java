package com.wedding.suite.dto.request;

import com.wedding.suite.enums.ResourceType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class WeddingResourceItem {
    @NotNull(message = "资源类型不能为空")
    private ResourceType type;

    @NotNull(message = "资源ID不能为空")
    @Positive(message = "资源ID必须为正数")
    private Long id;
}
