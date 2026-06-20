package com.tvstation.media.repository;

import com.tvstation.media.entity.TopicLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TopicLogRepository extends JpaRepository<TopicLog, Long>, JpaSpecificationExecutor<TopicLog> {

    List<TopicLog> findByTopicIdOrderByCreatedAtDesc(Long topicId);

    List<TopicLog> findByOperatorIdAndDeletedFalse(Long operatorId);
}
