package com.heritage.restoration.repository;

import com.heritage.restoration.entity.RestorationProject;
import com.heritage.restoration.enums.ProjectStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ProjectRepository extends MongoRepository<RestorationProject, String> {

    Page<RestorationProject> findByDeletedFalse(Pageable pageable);

    Page<RestorationProject> findByStatusAndDeletedFalse(ProjectStatus status, Pageable pageable);

    Page<RestorationProject> findByArtifactIdAndDeletedFalse(String artifactId, Pageable pageable);

    Page<RestorationProject> findBySupervisorIdAndDeletedFalse(String supervisorId, Pageable pageable);

    List<RestorationProject> findByStatusInAndDeletedFalse(List<ProjectStatus> statusList);

    @Query(value = "{ 'deleted': false, 'createdAt': { $gte: ?0, $lte: ?1 } }", count = true)
    long countByCreatedAtBetween(LocalDateTime from, LocalDateTime to);

    long countByStatusAndDeletedFalse(ProjectStatus status);
}
