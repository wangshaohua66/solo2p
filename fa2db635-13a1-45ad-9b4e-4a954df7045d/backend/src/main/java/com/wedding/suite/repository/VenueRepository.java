package com.wedding.suite.repository;

import com.wedding.suite.entity.VenueEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VenueRepository extends JpaRepository<VenueEntity, Long> {
    List<VenueEntity> findByStoreId(Long storeId);
}
