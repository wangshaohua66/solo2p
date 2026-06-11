package com.glassstudio.mapper;

import com.glassstudio.dto.BatchCreateDTO;
import com.glassstudio.entity.Batch;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface BatchMapper {

    @Mapping(target = "oxideComposition", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "supplierName", ignore = true)
    Batch toEntity(BatchCreateDTO dto);
}
