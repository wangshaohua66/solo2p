package com.mw.scheduling.repository;

import com.mw.common.enums.VehicleStatus;
import com.mw.scheduling.document.Vehicle;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface VehicleRepository extends MongoRepository<Vehicle, String> {

    Optional<Vehicle> findByPlateNo(String plateNo);

    List<Vehicle> findByStatus(VehicleStatus status);
}
