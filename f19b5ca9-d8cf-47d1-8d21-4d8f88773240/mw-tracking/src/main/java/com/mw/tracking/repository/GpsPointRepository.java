package com.mw.tracking.repository;

import com.mw.tracking.document.GpsPoint;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface GpsPointRepository extends MongoRepository<GpsPoint, String> {

    List<GpsPoint> findByVehicleIdAndTsBetweenOrderByTsAsc(String vehicleId, Long from, Long to);
}
