package com.heritage.artifact.repository;

import com.heritage.artifact.entity.Artifact;
import com.heritage.artifact.enums.ArtifactLevel;
import com.heritage.artifact.enums.ArtifactStatus;
import com.heritage.artifact.enums.ArtifactType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ArtifactRepository extends MongoRepository<Artifact, String> {

    Optional<Artifact> findByArtifactCode(String artifactCode);

    List<Artifact> findByType(ArtifactType type);

    List<Artifact> findByLevel(ArtifactLevel level);

    List<Artifact> findByStatus(ArtifactStatus status);

    Page<Artifact> findByType(ArtifactType type, Pageable pageable);

    Page<Artifact> findByLevel(ArtifactLevel level, Pageable pageable);

    Page<Artifact> findByStatus(ArtifactStatus status, Pageable pageable);

    Page<Artifact> findByDataAccessLevelLessThanEqual(Integer level, Pageable pageable);

    @Query("{'$or': [{'name': {$regex: ?0, $options: 'i'}}, {'description': {$regex: ?0, $options: 'i'}}, {'artifactCode': {$regex: ?0, $options: 'i'}}]}")
    Page<Artifact> findByKeyword(String keyword, Pageable pageable);

    long countByType(ArtifactType type);

    long countByLevel(ArtifactLevel level);

    long countByStatus(ArtifactStatus status);

    boolean existsByArtifactCode(String artifactCode);
}
