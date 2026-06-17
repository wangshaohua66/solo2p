package com.heritage.auth.repository;

import com.heritage.auth.entity.User;
import com.heritage.auth.enums.RoleType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    Optional<User> findByPhone(String phone);

    List<User> findByRolesContaining(RoleType role);

    List<User> findByRolesIn(Set<RoleType> roles);

    List<User> findByEnabledTrue();

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);
}
