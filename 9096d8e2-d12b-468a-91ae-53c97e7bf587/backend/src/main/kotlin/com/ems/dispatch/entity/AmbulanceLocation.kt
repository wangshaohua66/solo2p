package com.ems.dispatch.entity

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import org.locationtech.jts.geom.Point
import java.math.BigDecimal
import java.time.LocalDateTime

@Entity
@Table(name = "ambulance_locations")
class AmbulanceLocation(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ambulance_id", nullable = false)
    var ambulance: Ambulance,

    @JdbcTypeCode(SqlTypes.GEOMETRY)
    @Column(columnDefinition = "geography(Point,4326)", nullable = false)
    var location: Point,

    var speed: BigDecimal? = null,

    var heading: Int? = null,

    var altitude: BigDecimal? = null,

    @Column(name = "gps_accuracy")
    var gpsAccuracy: Int? = null,

    @Column(nullable = false)
    var timestamp: LocalDateTime = LocalDateTime.now(),

    @Column(name = "ignition_status")
    var ignitionStatus: Boolean? = null,

    var odometer: Int? = null
)
