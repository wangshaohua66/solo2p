package com.glassstudio.repository;

import com.glassstudio.entity.WatchlistEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WatchlistEntryRepository extends JpaRepository<WatchlistEntry, Long> {

    List<WatchlistEntry> findByMemberId(Long memberId);

    Optional<WatchlistEntry> findTopByMemberIdOrderByCreatedAtDesc(Long memberId);

    List<WatchlistEntry> findByIncidentId(Long incidentId);
}
