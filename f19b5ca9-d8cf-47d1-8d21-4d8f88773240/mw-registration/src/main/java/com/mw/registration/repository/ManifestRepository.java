package com.mw.registration.repository;

import com.mw.registration.document.ElectronicManifest;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ManifestRepository extends MongoRepository<ElectronicManifest, String> {

    Optional<ElectronicManifest> findByManifestNo(String manifestNo);
}
