package com.ems.dispatch.config

import org.apache.kafka.clients.admin.NewTopic
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.annotation.EnableKafka
import org.springframework.kafka.config.TopicBuilder

@Configuration
@EnableKafka
class KafkaConfig {

    @Value("\${ems.kafka.topics.vehicle-gps}")
    private lateinit var vehicleGpsTopic: String

    @Value("\${ems.kafka.topics.dispatch-event}")
    private lateinit var dispatchEventTopic: String

    @Value("\${ems.kafka.topics.medical-record}")
    private lateinit var medicalRecordTopic: String

    @Value("\${ems.kafka.topics.notification}")
    private lateinit var notificationTopic: String

    @Bean
    fun vehicleGpsTopic(): NewTopic = TopicBuilder
        .name(vehicleGpsTopic)
        .partitions(8)
        .replicas(1)
        .build()

    @Bean
    fun dispatchEventTopic(): NewTopic = TopicBuilder
        .name(dispatchEventTopic)
        .partitions(6)
        .replicas(1)
        .build()

    @Bean
    fun medicalRecordTopic(): NewTopic = TopicBuilder
        .name(medicalRecordTopic)
        .partitions(4)
        .replicas(1)
        .build()

    @Bean
    fun notificationTopic(): NewTopic = TopicBuilder
        .name(notificationTopic)
        .partitions(4)
        .replicas(1)
        .build()
}
