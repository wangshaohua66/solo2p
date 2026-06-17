package com.heritage.collab.repository;

import com.heritage.collab.entity.AppraisalTask;
import com.heritage.collab.enums.AppraisalStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AppraisalTaskRepository extends MongoRepository<AppraisalTask, String> {
    List<AppraisalTask> findByArtifactId(String artifactId);
    List<AppraisalTask> findByCreatorId(String creatorId);
    List<AppraisalTask> findByExpertIdsContaining(String expertId);
    Page<AppraisalTask> findByStatus(AppraisalStatus status, Pageable pageable);
    Page<AppraisalTask> findByCreatorId(String creatorId, Pageable pageable);
    Page<AppraisalTask> findByExpertIdsContaining(String expertId, Pageable pageable);
    long countByStatus(AppraisalStatus status);
}
