package com.ems.dispatch.util

import org.locationtech.jts.geom.Coordinate
import org.locationtech.jts.geom.GeometryFactory
import org.locationtech.jts.geom.Point
import org.locationtech.jts.geom.PrecisionModel

object GisUtils {
    private const val SRID = 4326
    private val geometryFactory = GeometryFactory(PrecisionModel(), SRID)

    fun createPoint(longitude: Double, latitude: Double): Point {
        return geometryFactory.createPoint(Coordinate(longitude, latitude))
    }

    fun toLocationDto(point: Point?): LocationDto? {
        return point?.let {
            LocationDto(it.x, it.y)
        }
    }

    fun calculateDistanceMeters(point1: Point, point2: Point): Double {
        return point1.distance(point2) * 111319.9
    }

    fun calculateEstimatedArrivalMinutes(
        distanceMeters: Double,
        averageSpeedKmh: Double = 60.0
    ): Int {
        val speedMetersPerMinute = averageSpeedKmh * 1000 / 60
        return (distanceMeters / speedMetersPerMinute).toInt().coerceAtLeast(1)
    }

    fun isPointWithinRadius(
        center: Point,
        point: Point,
        radiusMeters: Double
    ): Boolean {
        return calculateDistanceMeters(center, point) <= radiusMeters
    }
}

data class LocationDto(
    val longitude: Double,
    val latitude: Double
)
