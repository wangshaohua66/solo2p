package com.glassstudio.dto;

import com.glassstudio.entity.CurveSegment;
import jakarta.validation.Valid;
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
public class CurveUpdateDTO {

    @Size(max = 100, message = "曲线名称长度不能超过100")
    private String name;

    @Size(max = 500, message = "描述长度不能超过500")
    private String description;

    @Valid
    private List<CurveSegment> segments;

    private Boolean isTemplate;
}
