package com.wedding.suite.repository;

import com.wedding.suite.entity.FollowTaskEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FollowTaskRepository extends JpaRepository<FollowTaskEntity, Long> {
    List<FollowTaskEntity> findByWeddingId(Long weddingId);
}
