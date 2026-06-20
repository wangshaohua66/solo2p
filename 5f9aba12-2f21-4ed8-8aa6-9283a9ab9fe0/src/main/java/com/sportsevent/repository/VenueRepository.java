package com.sportsevent.repository;

import com.sportsevent.entity.Venue;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VenueRepository extends MongoRepository<Venue, String> {

    List<Venue> findByStatus(Venue.VenueStatus status);

    @Query("{'supportedSports': ?0, 'status': 'ACTIVE'}")
    List<Venue> findActiveBySport(com.sportsevent.entity.League.SportType sport);

    List<Venue> findByIdIn(List<String> ids);
}
