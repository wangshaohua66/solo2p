package com.glassstudio.mapper;

import com.glassstudio.dto.KilnOpenDTO;
import com.glassstudio.entity.KilnOpenRecord;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-06-11T11:20:40+0800",
    comments = "version: 1.5.5.Final, compiler: Eclipse JDT (IDE) 3.46.0.v20260407-0427, environment: Java 21.0.10 (Eclipse Adoptium)"
)
@Component
public class KilnOpenRecordMapperImpl implements KilnOpenRecordMapper {

    @Override
    public KilnOpenRecord toEntity(KilnOpenDTO dto) {
        if ( dto == null ) {
            return null;
        }

        KilnOpenRecord.KilnOpenRecordBuilder kilnOpenRecord = KilnOpenRecord.builder();

        kilnOpenRecord.kilnId( dto.getKilnId() );
        kilnOpenRecord.note( dto.getNote() );
        kilnOpenRecord.openTime( dto.getOpenTime() );
        kilnOpenRecord.operatorId( dto.getOperatorId() );
        kilnOpenRecord.scheduleId( dto.getScheduleId() );
        kilnOpenRecord.temperatureAtOpen( dto.getTemperatureAtOpen() );

        return kilnOpenRecord.build();
    }
}
