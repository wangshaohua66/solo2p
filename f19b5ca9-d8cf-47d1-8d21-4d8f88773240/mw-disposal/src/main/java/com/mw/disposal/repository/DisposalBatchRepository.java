package com.mw.disposal.repository;

import com.mw.disposal.document.DisposalBatch;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface DisposalBatchRepository extends MongoRepository<DisposalBatch, String> {

    Optional<DisposalBatch> findByBatchNo(String batchNo);

    Optional<DisposalBatch> findByManifestNo(String manifestNo);
}
