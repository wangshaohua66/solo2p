package com.heritage.restoration.repository;

import com.heritage.restoration.entity.RestorationPhoto;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PhotoRepository extends MongoRepository<RestorationPhoto, String> {
    List<RestorationPhoto> findByProjectIdOrderByCreatedAtDesc(String projectId);
    List<RestorationPhoto> findByProjectIdAndStageOrderByCreatedAtDesc(String projectId, String stage);
    void deleteByProjectId(String projectId);
}
