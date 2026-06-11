package com.glassstudio.repository;

import com.glassstudio.entity.MemberRole;
import com.glassstudio.entity.MemberRoleConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MemberRoleConfigRepository extends JpaRepository<MemberRoleConfig, Long> {

    Optional<MemberRoleConfig> findByRole(MemberRole role);

    boolean existsByRole(MemberRole role);
}
