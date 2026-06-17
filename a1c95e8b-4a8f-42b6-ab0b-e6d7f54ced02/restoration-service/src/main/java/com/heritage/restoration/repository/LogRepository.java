package com.heritage.restoration.repository;

import com.heritage.restoration.entity.RestorationLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LogRepository extends MongoRepository<RestorationLog, String> {
    List<RestorationLog> findByProjectIdOrderByCreatedAtDesc(String projectId);
    Page<RestorationLog> findByProjectIdOrderByCreatedAtDesc(String projectId, Pageable pageable);
}
