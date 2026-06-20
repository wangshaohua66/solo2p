package com.mw.registration.repository;

import com.mw.registration.document.WasteRecord;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface WasteRecordRepository extends MongoRepository<WasteRecord, String> {

    Optional<WasteRecord> findByTraceCode(String traceCode);

    List<WasteRecord> findByManifestNo(String manifestNo);

    List<WasteRecord> findByTraceCodeIn(Collection<String> traceCodes);
}
