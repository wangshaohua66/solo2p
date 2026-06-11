package com.glassstudio.dto;

import com.glassstudio.entity.CurveSegment;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CurveCreateDTO {

    @NotBlank(message = "曲线名称不能为空")
    @Size(max = 100, message = "曲线名称长度不能超过100")
    private String name;

    @NotNull(message = "曲线段不能为空")
    @Valid
    private List<CurveSegment> segments;

    private Boolean isTemplate;
}
