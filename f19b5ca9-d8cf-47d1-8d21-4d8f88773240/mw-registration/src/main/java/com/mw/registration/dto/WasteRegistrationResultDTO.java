package com.mw.registration.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WasteRegistrationResultDTO {

    private int total;
    private int success;
    private List<String> traceCodes;
    private String manifestNo;
}
