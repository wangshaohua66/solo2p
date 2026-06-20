package com.notarization.repository;

import com.notarization.model.User;
import com.notarization.model.enums.HallId;
import com.notarization.model.enums.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByUsername(String username);

    List<User> findByRoleAndAvailable(UserRole role, boolean available);

    List<User> findByRoleAndAvailableAndHallId(UserRole role, boolean available, HallId hallId);

    Page<User> findByRole(UserRole role, Pageable pageable);

    boolean existsByUsername(String username);
}
