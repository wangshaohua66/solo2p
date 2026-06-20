package com.notarization.repository;

import com.notarization.model.AccessToken;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AccessTokenRepository extends MongoRepository<AccessToken, String> {

    Optional<AccessToken> findByToken(String token);

    void deleteByUserId(String userId);

    boolean existsByTokenAndRevokedFalse(String token);
}
