package com.mw.tracking.repository;

import com.mw.tracking.document.VehicleLocation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface VehicleLocationRepository extends MongoRepository<VehicleLocation, String> {

    Optional<VehicleLocation> findByVehicleId(String vehicleId);
}
