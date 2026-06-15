package com.ems.dispatch.entity

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import org.locationtech.jts.geom.Point
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.LocalDateTime

@Entity
@Table(name = "hospitals")
@EntityListeners(AuditingEntityListener::class)
class Hospital(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(nullable = false, length = 200)
    var name: String,

    @Column(length = 500)
    var address: String? = null,

    @Column(length = 20)
    var phone: String? = null,

    @Column(length = 20)
    var level: String? = null,

    @Column(name = "emergency_department")
    var emergencyDepartment: Boolean = true,

    @JdbcTypeCode(SqlTypes.GEOMETRY)
    @Column(columnDefinition = "geography(Point,4326)")
    var location: Point? = null,

    @Column(name = "available_beds")
    var availableBeds: Int = 0,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(),

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
)
