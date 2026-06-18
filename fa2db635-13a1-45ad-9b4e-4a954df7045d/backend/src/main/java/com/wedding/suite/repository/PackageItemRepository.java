package com.wedding.suite.repository;

import com.wedding.suite.entity.PackageItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PackageItemRepository extends JpaRepository<PackageItemEntity, Long> {
}
