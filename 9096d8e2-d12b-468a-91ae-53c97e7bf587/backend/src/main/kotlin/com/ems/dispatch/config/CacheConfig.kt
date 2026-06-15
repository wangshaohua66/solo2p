package com.ems.dispatch.config

import com.github.benmanes.caffeine.cache.Caffeine
import org.springframework.cache.CacheManager
import org.springframework.cache.annotation.EnableCaching
import org.springframework.cache.caffeine.CaffeineCacheManager
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.util.concurrent.TimeUnit

@Configuration
@EnableCaching
class CacheConfig {

    @Bean
    fun cacheManager(): CacheManager {
        val cacheManager = CaffeineCacheManager()

        cacheManager.setCacheNames(listOf(
            "ambulanceLocations",
            "ambulanceList",
            "dispatchDashboard",
            "activeEvents",
            "medicalRecords",
            "qualityMetrics",
            "vehicleStats",
            "dispatchEvent",
            "nearbyAmbulances",
            "medicalRecordDetail"
        ))

        cacheManager.setCaffeine(
            Caffeine.newBuilder()
                .maximumSize(1000)
                .expireAfterWrite(5, TimeUnit.MINUTES)
                .expireAfterAccess(2, TimeUnit.MINUTES)
                .recordStats()
        )

        return cacheManager
    }

    @Bean
    fun dashboardCacheManager(): CacheManager {
        val cacheManager = CaffeineCacheManager("dispatchDashboard")
        cacheManager.setCaffeine(
            Caffeine.newBuilder()
                .maximumSize(1)
                .expireAfterWrite(3, TimeUnit.SECONDS)
                .recordStats()
        )
        return cacheManager
    }

    @Bean
    fun ambulanceLocationCacheManager(): CacheManager {
        val cacheManager = CaffeineCacheManager("ambulanceLocations")
        cacheManager.setCaffeine(
            Caffeine.newBuilder()
                .maximumSize(200)
                .expireAfterWrite(3, TimeUnit.SECONDS)
                .recordStats()
        )
        return cacheManager
    }

    @Bean
    fun nearbyAmbulancesCacheManager(): CacheManager {
        val cacheManager = CaffeineCacheManager("nearbyAmbulances")
        cacheManager.setCaffeine(
            Caffeine.newBuilder()
                .maximumSize(100)
                .expireAfterWrite(2, TimeUnit.SECONDS)
                .recordStats()
        )
        return cacheManager
    }

    @Bean
    fun qualityMetricsCacheManager(): CacheManager {
        val cacheManager = CaffeineCacheManager("qualityMetrics")
        cacheManager.setCaffeine(
            Caffeine.newBuilder()
                .maximumSize(10)
                .expireAfterWrite(5, TimeUnit.MINUTES)
                .recordStats()
        )
        return cacheManager
    }
}
