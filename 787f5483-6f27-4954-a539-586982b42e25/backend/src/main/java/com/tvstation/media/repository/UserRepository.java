package com.tvstation.media.repository;

import com.tvstation.media.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    Optional<User> findByUsernameAndDeletedFalse(String username);

    List<User> findByDepartmentAndDeletedFalse(String department);

    List<User> findByRoleAndDeletedFalse(User.UserRole role);

    boolean existsByUsernameAndDeletedFalse(String username);

    Optional<User> findByIdAndDeletedFalse(Long id);

    List<User> findByRoleInAndDeletedFalse(List<User.UserRole> roles);
}
