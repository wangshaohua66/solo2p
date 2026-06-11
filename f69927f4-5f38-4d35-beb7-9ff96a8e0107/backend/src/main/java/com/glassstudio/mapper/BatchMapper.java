package com.glassstudio.mapper;

import com.glassstudio.dto.BatchCreateDTO;
import com.glassstudio.entity.Batch;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface BatchMapper {

    Batch toEntity(BatchCreateDTO dto);
}
