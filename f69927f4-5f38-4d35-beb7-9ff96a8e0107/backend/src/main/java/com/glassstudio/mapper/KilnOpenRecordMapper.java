package com.glassstudio.mapper;

import com.glassstudio.dto.KilnOpenDTO;
import com.glassstudio.entity.KilnOpenRecord;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface KilnOpenRecordMapper {

    KilnOpenRecord toEntity(KilnOpenDTO dto);
}
