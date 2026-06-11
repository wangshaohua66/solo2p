package com.glassstudio.mapper;

import com.glassstudio.dto.BatchCreateDTO;
import com.glassstudio.entity.Batch;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-06-11T14:49:02+0800",
    comments = "version: 1.5.5.Final, compiler: Eclipse JDT (IDE) 3.46.0.v20260407-0427, environment: Java 21.0.10 (Eclipse Adoptium)"
)
@Component
public class BatchMapperImpl implements BatchMapper {

    @Override
    public Batch toEntity(BatchCreateDTO dto) {
        if ( dto == null ) {
            return null;
        }

        Batch.BatchBuilder batch = Batch.builder();

        batch.batchNo( dto.getBatchNo() );
        batch.supplierId( dto.getSupplierId() );
        batch.materialName( dto.getMaterialName() );
        batch.quantity( dto.getQuantity() );
        batch.unitPrice( dto.getUnitPrice() );
        batch.unit( dto.getUnit() );
        batch.expiryDate( dto.getExpiryDate() );
        batch.spectralData( dto.getSpectralData() );

        return batch.build();
    }
}
