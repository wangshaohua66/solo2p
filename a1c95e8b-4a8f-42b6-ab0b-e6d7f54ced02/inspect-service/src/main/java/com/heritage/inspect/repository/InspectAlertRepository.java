package com.heritage.inspect.repository;

import com.heritage.inspect.entity.InspectAlert;
import com.heritage.inspect.enums.AlertLevel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InspectAlertRepository extends MongoRepository<InspectAlert, String> {
    List<InspectAlert> findByAcknowledgedFalse();
    Page<InspectAlert> findByAcknowledgedFalse(Pageable pageable);
    Page<InspectAlert> findByLevel(AlertLevel level, Pageable pageable);
    List<InspectAlert> findByArtifactId(String artifactId);
    long countByAcknowledgedFalse();
    long countByLevelAndAcknowledgedFalse(AlertLevel level);
}
