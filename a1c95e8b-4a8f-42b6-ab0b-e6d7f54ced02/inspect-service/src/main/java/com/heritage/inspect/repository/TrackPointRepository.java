package com.heritage.inspect.repository;

import com.heritage.inspect.entity.TrackPoint;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TrackPointRepository extends MongoRepository<TrackPoint, String> {
    List<TrackPoint> findByTaskIdOrderByTimeAsc(String taskId);
    List<TrackPoint> findByInspectorIdAndTimeBetweenOrderByTimeAsc(String inspectorId, LocalDateTime start, LocalDateTime end);
    void deleteByTaskId(String taskId);
}
