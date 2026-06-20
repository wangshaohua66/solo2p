package com.mw.supervision.repository;

import com.mw.common.enums.AlertType;
import com.mw.supervision.document.AlertRule;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AlertRuleRepository extends MongoRepository<AlertRule, String> {

    List<AlertRule> findByEnabledTrue();

    Optional<AlertRule> findByType(AlertType type);
}
