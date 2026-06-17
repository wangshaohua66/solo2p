package com.heritage.collab.repository;

import com.heritage.collab.entity.Annotation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnnotationRepository extends MongoRepository<Annotation, String> {
    List<Annotation> findByAppraisalId(String appraisalId);
    List<Annotation> findByArtifactId(String artifactId);
    List<Annotation> findByImageId(String imageId);
    List<Annotation> findByExpertId(String expertId);
    void deleteByAppraisalId(String appraisalId);
}
