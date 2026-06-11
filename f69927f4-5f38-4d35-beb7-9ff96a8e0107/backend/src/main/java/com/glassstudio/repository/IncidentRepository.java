package com.glassstudio.repository;

import com.glassstudio.entity.Incident;
import com.glassstudio.entity.IncidentSeverity;
import com.glassstudio.entity.IncidentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {

    List<Incident> findByMemberId(Long memberId);

    List<Incident> findByType(IncidentType type);

    List<Incident> findBySeverity(IncidentSeverity severity);

    List<Incident> findByResolvedFalse();

    List<Incident> findByKilnOpenRecordId(Long kilnOpenRecordId);
}
