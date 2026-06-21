package com.court.execution.repository;

import com.court.execution.entity.Notification;
import com.court.execution.entity.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByReceiverIdOrderByCreateTimeDesc(Long receiverId);

    Page<Notification> findByReceiverId(Long receiverId, Pageable pageable);

    long countByReceiverIdAndReadFalse(Long receiverId);

    List<Notification> findByReceiverIdAndReadFalse(Long receiverId);

    List<Notification> findByReceiverIdAndReadFalseOrderByCreateTimeDesc(Long receiverId);

    List<Notification> findByReceiverIdAndType(Long receiverId, NotificationType type);
}
