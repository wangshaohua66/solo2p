package com.mw.supervision.repository;

import com.mw.supervision.document.Alert;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AlertRepository extends MongoRepository<Alert, String> {

    Optional<Alert> findByTypeAndBusinessKeyAndStatus(String type, String businessKey, String status);

    List<Alert> findByStatus(String status);

    List<Alert> findByPushStatus(String pushStatus);
}
