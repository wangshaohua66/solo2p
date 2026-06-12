package com.carbon.calc.repository;

import com.carbon.common.enums.AccountingStandard;
import com.carbon.calc.entity.CalculationDiff;
import com.carbon.calc.entity.CalculationResult;
import com.carbon.calc.entity.CalculationTask;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CalculationTaskRepository extends MongoRepository<CalculationTask, String> {

    Page<CalculationTask> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);

    List<CalculationTask> findByTenantIdAndPeriod(String tenantId, String period);

    long countByTenantIdAndStatus(String tenantId, String status);
}

@Repository
interface CalculationResultRepository extends MongoRepository<CalculationResult, String> {

    List<CalculationResult> findByTaskId(String taskId);

    List<CalculationResult> findByTaskIdAndStandard(String taskId, AccountingStandard standard);

    List<CalculationResult> findByTenantIdAndPeriodAndStandardOrderByCo2eqTonsDesc(
            String tenantId, String period, AccountingStandard standard);

    @Query("{'taskId': ?0, 'standard': ?1}")
    Page<CalculationResult> findPageByTaskAndStandard(String taskId, AccountingStandard standard, Pageable pageable);

    @Aggregation(pipeline = {
            "{$match: {'taskId': ?0, 'standard': ?1}}",
            "{$group: {_id: '$gas', total: {$sum: '$co2eqTons'}}}"
    })
    List<org.bson.Document> aggregateByGas(String taskId, AccountingStandard standard);

    @Aggregation(pipeline = {
            "{$match: {'taskId': ?0, 'standard': ?1}}",
            "{$group: {_id: '$scope', total: {$sum: '$co2eqTons'}}}"
    })
    List<org.bson.Document> aggregateByScope(String taskId, AccountingStandard standard);

    @Aggregation(pipeline = {
            "{$match: {'taskId': ?0, 'standard': ?1}}",
            "{$group: {_id: null, total: {$sum: '$co2eqTons'}}}"
    })
    List<org.bson.Document> sumTotal(String taskId, AccountingStandard standard);

    void deleteByTaskId(String taskId);
}

@Repository
interface CalculationDiffRepository extends MongoRepository<CalculationDiff, String> {

    List<CalculationDiff> findByTaskIdOrderByDeltaAbsDesc(String taskId);

    @Query("{'taskId': ?0, 'standardA': ?1, 'standardB': ?2}")
    List<CalculationDiff> findByTaskAndStandardPair(String taskId, AccountingStandard a, AccountingStandard b);

    @Aggregation(pipeline = {
            "{$match: {'taskId': ?0}}",
            "{$group: {_id: {a:'$standardA',b:'$standardB'}, count:{$sum:1}, totalDelta:{$sum:'$deltaAbs'}}}"
    })
    List<org.bson.Document> summaryByPair(String taskId);

    void deleteByTaskId(String taskId);
}
