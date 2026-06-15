package com.ems.dispatch.repository

import com.ems.dispatch.entity.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface UserRepository : JpaRepository<User, Long> {
    fun findByUsername(username: String): User?
    fun findByRolesContaining(role: String): List<User>
    fun existsByUsername(username: String): Boolean
}
