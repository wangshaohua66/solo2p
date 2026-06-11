package com.glassstudio.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CurveCreateDTO {

    @NotBlank(message = "曲线名称不能为空")
    @Size(max = 100, message = "曲线名称长度不能超过100")
    private String name;

    @NotBlank(message = "曲线段不能为空")
    private String segments;

    private Boolean isTemplate;
}
