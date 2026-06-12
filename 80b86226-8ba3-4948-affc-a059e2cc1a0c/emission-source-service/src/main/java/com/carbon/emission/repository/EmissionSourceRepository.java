package com.carbon.emission.repository;

import com.carbon.common.enums.ScopeType;
import com.carbon.emission.entity.EmissionSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmissionSourceRepository extends MongoRepository<EmissionSource, String> {

    Optional<EmissionSource> findByTenantIdAndCode(String tenantId, String code);

    List<EmissionSource> findByTenantIdAndScope(String tenantId, ScopeType scope);

    List<EmissionSource> findByTenantIdAndStatus(String tenantId, String status);

    Page<EmissionSource> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    @Query(value = "{'tenantId': ?0, '$or': [{'name': {$regex: ?1, $options: 'i'}}, {'code': {$regex: ?1, $options: 'i'}}]}")
    Page<EmissionSource> search(String tenantId, String keyword, Pageable pageable);

    @Query("{'tenantId': ?0, 'scope': ?1}")
    Page<EmissionSource> findByTenantIdAndScope(String tenantId, ScopeType scope, Pageable pageable);

    long countByTenantId(String tenantId);

    long countByTenantIdAndScope(String tenantId, ScopeType scope);

    long countByTenantIdAndStatus(String tenantId, String status);

    @Query(value = "{'tenantId': ?0}", fields = "{'id':1, 'code':1, 'name':1, 'scope':1, 'activityDataType':1, 'factorMatchKey':1}")
    List<EmissionSource> findBriefByTenantId(String tenantId);
}
