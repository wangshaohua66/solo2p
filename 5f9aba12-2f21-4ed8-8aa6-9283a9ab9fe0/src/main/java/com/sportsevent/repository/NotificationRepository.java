package com.sportsevent.repository;

import com.sportsevent.entity.Notification;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NotificationRepository extends MongoRepository<Notification, String> {

    List<Notification> findByStatus(Notification.NotificationStatus status);

    @Query("{'recipients.recipientId': ?0}")
    List<Notification> findByRecipientId(String recipientId);

    @Query("{'relatedEntityId': ?0, 'relatedEntityType': ?1}")
    List<Notification> findByRelatedEntity(String relatedEntityId, String relatedEntityType);

    @Query("{'status': {$in: ['PENDING', 'FAILED']}, 'scheduledAt': {$lte: ?0}}")
    List<Notification> findPendingNotifications(LocalDateTime now);
}
