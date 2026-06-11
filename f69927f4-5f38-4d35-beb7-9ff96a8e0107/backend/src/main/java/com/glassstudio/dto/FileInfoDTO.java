package com.glassstudio.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FileInfoDTO {

    private String fileName;
    private String originalFileName;
    private Long size;
    private String url;
}
