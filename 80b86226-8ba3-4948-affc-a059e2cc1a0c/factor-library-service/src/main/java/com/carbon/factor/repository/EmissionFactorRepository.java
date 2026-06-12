package com.carbon.factor.repository;

import com.carbon.common.enums.ActivityDataType;
import com.carbon.common.enums.FactorLibrary;
import com.carbon.common.enums.GreenhouseGas;
import com.carbon.common.enums.ScopeType;
import com.carbon.factor.entity.EmissionFactor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface EmissionFactorRepository extends MongoRepository<EmissionFactor, String> {

    Optional<EmissionFactor> findByLibraryAndMatchKeyAndVersionCode(
            FactorLibrary library, String matchKey, String versionCode);

    @Query("{'library': ?0, 'matchKey': ?1, 'versionCode': ?2, 'gas': ?3}")
    Optional<EmissionFactor> findByLibraryMatchKeyVersionAndGas(
            FactorLibrary library, String matchKey, String versionCode, GreenhouseGas gas);

    List<EmissionFactor> findByLibraryAndVersionCode(FactorLibrary library, String versionCode);

    Page<EmissionFactor> findByLibraryAndVersionCode(FactorLibrary library, String versionCode, Pageable pageable);

    Page<EmissionFactor> findByLibrary(FactorLibrary library, Pageable pageable);

    @Query(value = "{'library': ?0, 'versionCode': ?1, '$or': [{'matchKey': {$regex: ?2, $options: 'i'}}, {'factorName': {$regex: ?2, $options: 'i'}}]}")
    Page<EmissionFactor> search(FactorLibrary library, String versionCode, String keyword, Pageable pageable);

    List<EmissionFactor> findByLibraryAndScopeAndActivityDataType(
            FactorLibrary library, ScopeType scope, ActivityDataType type);

    @Query("{'library': ?0, 'matchKey': {$in: ?1}, 'versionCode': ?2}")
    List<EmissionFactor> findByLibraryAndMatchKeysInAndVersion(
            FactorLibrary library, List<String> matchKeys, String versionCode);

    long countByLibraryAndVersionCode(FactorLibrary library, String versionCode);

    @Aggregation(pipeline = {
            "{$match: {'library': ?0, 'versionCode': ?1}}",
            "{$group: {_id: '$gas', count: {$sum: 1}}}"
    })
    List<org.bson.Document> summarizeByGas(FactorLibrary library, String versionCode);

    @Query("{'library': ?0, 'matchKey': ?1, 'effectiveFrom': {$lte: ?2}, '$or': [{'effectiveTo': {$gte: ?2}}, {'effectiveTo': null}]}")
    Optional<EmissionFactor> findEffectiveByPeriod(FactorLibrary library, String matchKey, LocalDate periodDate);

    List<EmissionFactor> findByLibraryAndMatchKeyOrderByEffectiveFromDesc(
            FactorLibrary library, String matchKey);
}
