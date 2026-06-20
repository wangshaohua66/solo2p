package com.notarization.repository;

import com.notarization.model.StatisticRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface StatisticRepository extends MongoRepository<StatisticRecord, String> {

    List<StatisticRecord> findByPeriodTypeAndCreatedAtBetween(StatisticRecord.PeriodType periodType, Instant start, Instant end);

    Optional<StatisticRecord> findFirstByPeriodTypeOrderByCreatedAtDesc(StatisticRecord.PeriodType periodType);
}
