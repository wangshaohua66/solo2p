package com.heritage.restoration.repository;

import com.heritage.restoration.entity.RestorationMaterial;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialRepository extends MongoRepository<RestorationMaterial, String> {
    List<RestorationMaterial> findByProjectIdOrderByUsedAtDesc(String projectId);
    void deleteByProjectId(String projectId);
}
