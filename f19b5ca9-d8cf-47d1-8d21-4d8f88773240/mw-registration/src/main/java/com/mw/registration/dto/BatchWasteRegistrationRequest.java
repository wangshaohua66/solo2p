package com.mw.registration.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class BatchWasteRegistrationRequest {

    @NotEmpty(message = "登记记录不能为空")
    @Size(max = 500, message = "单次批量登记不超过500条")
    @Valid
    private List<WasteRegistrationItemDTO> records;
}
