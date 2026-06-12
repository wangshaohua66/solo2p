package com.carbon.emission.repository;

import com.carbon.common.enums.ActivityDataType;
import com.carbon.emission.entity.ActivityData;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ActivityDataRepository extends MongoRepository<ActivityData, String> {

    Optional<ActivityData> findByTenantIdAndSourceIdAndPeriod(String tenantId, String sourceId, String period);

    List<ActivityData> findByTenantIdAndSourceIdAndPeriodYearAndPeriodMonth(
            String tenantId, String sourceId, Integer year, Integer month);

    List<ActivityData> findByTenantIdAndPeriodYearAndPeriodMonth(
            String tenantId, Integer year, Integer month);

    List<ActivityData> findByTenantIdAndPeriod(String tenantId, String period);

    Page<ActivityData> findByTenantIdAndPeriod(String tenantId, String period, Pageable pageable);

    List<ActivityData> findByTenantIdAndSourceIdOrderByPeriodYearAscPeriodMonthAsc(
            String tenantId, String sourceId);

    Page<ActivityData> findByTenantIdAndImportBatchId(String tenantId, String batchId, Pageable pageable);

    long countByTenantIdAndPeriodYearAndPeriodMonth(String tenantId, Integer year, Integer month);

    long countByTenantIdAndPeriodAndInterpolatedTrue(String tenantId, String period);

    void deleteByTenantIdAndPeriod(String tenantId, String period);

    @Query(value = "{'tenantId':?0, 'periodYear':?1, 'periodMonth':?2, 'activityDataType': ?3}")
    List<ActivityData> findByTenantPeriodAndType(String tenantId, Integer year, Integer month, ActivityDataType type);

    @Aggregation(pipeline = {
            "{$match: {'tenantId': ?0, 'periodYear': ?1, 'periodMonth': ?2}}",
            "{$group: {_id: '$activityDataType', count: {$sum: 1}, interpolated: {$sum: {$cond: ['$interpolated', 1, 0]}}}}"
    })
    List<org.bson.Document> summarizeByType(String tenantId, Integer year, Integer month);
}
