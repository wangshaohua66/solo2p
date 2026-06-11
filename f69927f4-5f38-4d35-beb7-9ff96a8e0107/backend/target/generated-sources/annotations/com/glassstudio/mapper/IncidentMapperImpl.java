package com.glassstudio.mapper;

import com.glassstudio.dto.IncidentCreateDTO;
import com.glassstudio.entity.Incident;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-06-11T12:19:09+0800",
    comments = "version: 1.5.5.Final, compiler: Eclipse JDT (IDE) 3.46.0.v20260407-0427, environment: Java 21.0.10 (Eclipse Adoptium)"
)
@Component
public class IncidentMapperImpl implements IncidentMapper {

    @Override
    public Incident toEntity(IncidentCreateDTO dto) {
        if ( dto == null ) {
            return null;
        }

        Incident.IncidentBuilder incident = Incident.builder();

        incident.description( dto.getDescription() );
        incident.kilnOpenRecordId( dto.getKilnOpenRecordId() );
        incident.memberId( dto.getMemberId() );
        incident.severity( dto.getSeverity() );
        incident.type( dto.getType() );

        return incident.build();
    }
}
