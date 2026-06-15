package com.ems.dispatch.util

import org.springframework.stereotype.Component
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.atomic.AtomicInteger

@Component
class EventNoGenerator {
    private val emergencyCallCounter = AtomicInteger(1)
    private val recordCounter = AtomicInteger(1)
    private val reviewCounter = AtomicInteger(1)
    private val notificationCounter = AtomicInteger(1)

    private val dateFormatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")

    fun generateEventNo(): String {
        val timestamp = LocalDateTime.now().format(dateFormatter)
        val sequence = emergencyCallCounter.getAndIncrement().toString().padStart(4, '0')
        return "EM$timestamp$sequence"
    }

    fun generateRecordNo(): String {
        val timestamp = LocalDateTime.now().format(dateFormatter)
        val sequence = recordCounter.getAndIncrement().toString().padStart(4, '0')
        return "MR$timestamp$sequence"
    }

    fun generateReviewNo(): String {
        val timestamp = LocalDateTime.now().format(dateFormatter)
        val sequence = reviewCounter.getAndIncrement().toString().padStart(4, '0')
        return "QR$timestamp$sequence"
    }

    fun generateNotificationNo(): String {
        val timestamp = LocalDateTime.now().format(dateFormatter)
        val sequence = notificationCounter.getAndIncrement().toString().padStart(4, '0')
        return "NT$timestamp$sequence"
    }
}
