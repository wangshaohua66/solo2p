package com.wedding.suite.repository;

import com.wedding.suite.entity.PropEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PropRepository extends JpaRepository<PropEntity, Long> {
    List<PropEntity> findByStoreId(Long storeId);
}
