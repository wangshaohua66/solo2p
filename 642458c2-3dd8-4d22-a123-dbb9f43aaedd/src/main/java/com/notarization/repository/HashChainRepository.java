package com.notarization.repository;

import com.notarization.model.HashChain;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface HashChainRepository extends MongoRepository<HashChain, String> {

    Optional<HashChain> findByChainId(String chainId);

    boolean existsByChainId(String chainId);

    Optional<HashChain> findByCaseId(String caseId);
}
