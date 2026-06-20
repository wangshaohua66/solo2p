package com.sportsevent.repository;

import com.sportsevent.entity.GroupDefinition;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupDefinitionRepository extends MongoRepository<GroupDefinition, String> {

    List<GroupDefinition> findByLeagueId(String leagueId);

    List<GroupDefinition> findByLeagueIdAndStatus(String leagueId, GroupDefinition.GroupStatus status);

    Optional<GroupDefinition> findByLeagueIdAndName(String leagueId, String name);

    List<GroupDefinition> findByLeagueIdOrderByDisplayOrderAsc(String leagueId);
}
