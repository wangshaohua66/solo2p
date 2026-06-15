package com.ems.dispatch.entity

import jakarta.persistence.*
import org.springframework.data.annotation.CreatedBy
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedBy
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.LocalDateTime

@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener::class)
class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(nullable = false, unique = true, length = 50)
    var username: String,

    @Column(name = "password_hash", nullable = false)
    var passwordHash: String,

    @Column(name = "real_name", nullable = false, length = 100)
    var realName: String,

    @Column(length = 20)
    var phone: String? = null,

    @Column(length = 100)
    var email: String? = null,

    @Column(nullable = false, length = 100)
    var roles: String = "DISPATCHER",

    @Column(length = 100)
    var department: String? = null,

    @Column(nullable = false)
    var enabled: Boolean = true,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(),

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),

    @CreatedBy
    @Column(name = "created_by")
    var createdBy: Long? = null,

    @LastModifiedBy
    @Column(name = "updated_by")
    var updatedBy: Long? = null
)
