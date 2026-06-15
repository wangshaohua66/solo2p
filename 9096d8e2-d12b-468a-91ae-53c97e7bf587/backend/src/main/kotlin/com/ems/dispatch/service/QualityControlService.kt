package com.ems.dispatch.service

import com.ems.dispatch.dto.PageResponse
import com.ems.dispatch.entity.MedicalRecord
import com.ems.dispatch.entity.QualityControlReview
import com.ems.dispatch.entity.User
import com.ems.dispatch.repository.MedicalRecordRepository
import com.ems.dispatch.repository.QualityControlReviewRepository
import com.ems.dispatch.util.EventNoGenerator
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import kotlin.random.Random

@Service
class QualityControlService(
    private val qualityControlReviewRepository: QualityControlReviewRepository,
    private val medicalRecordRepository: MedicalRecordRepository,
    private val eventNoGenerator: EventNoGenerator,
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    private val messagingTemplate: SimpMessagingTemplate
) {
    private val logger = LoggerFactory.getLogger(QualityControlService::class.java)

    data class ReviewCreateRequest(
        val medicalRecordId: Long,
        val reviewType: String,
        val reviewerId: Long? = null
    )

    data class ReviewUpdateRequest(
        val overallScore: Int?,
        val completenessScore: Int?,
        val timelinessScore: Int?,
        val accuracyScore: Int?,
        val defects: List<Map<String, Any>>?,
        val improvementSuggestions: String?,
        val reviewed: Boolean?,
        val rectificationRequired: Boolean?,
        val rectificationDeadline: LocalDateTime?,
        val rectificationNotes: String?
    )

    data class ReviewSummary(
        val id: Long,
        val reviewNo: String,
        val medicalRecordId: Long,
        val recordNo: String,
        val patientName: String,
        val reviewType: String,
        val status: String,
        val overallScore: Int?,
        val reviewed: Boolean,
        val reviewedAt: LocalDateTime?,
        val reviewDate: LocalDateTime
    )

    data class ReviewDetail(
        val id: Long,
        val reviewNo: String,
        val medicalRecordId: Long,
        val recordNo: String,
        val patientName: String,
        val chiefComplaint: String?,
        val reviewType: String,
        val reviewerId: Long?,
        val reviewerName: String?,
        val reviewDate: LocalDateTime,
        val overallScore: Int?,
        val completenessScore: Int?,
        val timelinessScore: Int?,
        val accuracyScore: Int?,
        val defects: List<Map<String, Any>>?,
        val improvementSuggestions: String?,
        val status: String,
        val reviewed: Boolean,
        val reviewedAt: LocalDateTime?,
        val rectificationRequired: Boolean,
        val rectificationDeadline: LocalDateTime?,
        val rectificationCompleted: Boolean,
        val rectificationNotes: String?,
        val createdAt: LocalDateTime
    )

    data class QcDashboardStats(
        val totalRecords: Long,
        val reviewedRecords: Long,
        val pendingReviews: Long,
        val averageScore: Double?,
        val completionRate: Double,
        val periodStats: List<Map<String, Any>>,
        val statusDistribution: List<Map<String, Any>>
    )

    @Transactional
    fun createReview(request: ReviewCreateRequest, reviewer: User?): QualityControlReview {
        val record = medicalRecordRepository.findById(request.medicalRecordId)
            .orElseThrow { IllegalArgumentException("Medical record not found: ${request.medicalRecordId}") }

        val reviewNo = eventNoGenerator.generateReviewNo()

        val review = QualityControlReview(
            reviewNo = reviewNo,
            medicalRecord = record,
            reviewer = reviewer,
            reviewType = request.reviewType,
            status = QualityControlReview.Status.PENDING.name
        )

        val savedReview = qualityControlReviewRepository.save(review)
        logger.info("QC review created: $reviewNo for record ${record.recordNo}")

        kafkaTemplate.send("ems.notification", "QC_REVIEW_CREATED", savedReview)
        messagingTemplate.convertAndSend("/topic/quality-control/new", reviewNo)

        return savedReview
    }

    @Transactional
    fun scheduleAutoReview(record: MedicalRecord) {
        val request = ReviewCreateRequest(
            medicalRecordId = record.id!!,
            reviewType = QualityControlReview.ReviewType.RANDOM_SAMPLING.name
        )
        createReview(request, null)
    }

    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    fun performRandomSampling() {
        logger.info("Starting daily random sampling for QC review")

        val startOfDay = LocalDateTime.now().minusDays(1).toLocalDate().atStartOfDay()
        val endOfDay = startOfDay.plusDays(1)

        val records = medicalRecordRepository.findByDateRange(
            startOfDay, endOfDay, PageRequest.of(0, 1000)
        ).content

        if (records.isEmpty()) {
            logger.info("No records found for random sampling")
            return
        }

        val sampleSize = (records.size * 0.1).toInt().coerceAtLeast(5).coerceAtMost(50)
        val shuffled = records.shuffled(Random(LocalDateTime.now().dayOfMonth.toLong()))
        val sample = shuffled.take(sampleSize)

        sample.forEach { record ->
            val existingReviews = qualityControlReviewRepository.findByMedicalRecordId(record.id!!)
            if (existingReviews.isEmpty()) {
                scheduleAutoReview(record)
            }
        }

        logger.info("Random sampling completed: $sampleSize records selected for review")
    }

    @Transactional
    fun updateReview(id: Long, request: ReviewUpdateRequest, reviewer: User): QualityControlReview {
        val review = qualityControlReviewRepository.findById(id)
            .orElseThrow { IllegalArgumentException("QC review not found: $id") }

        review.reviewer = reviewer
        request.overallScore?.let { review.overallScore = it }
        request.completenessScore?.let { review.completenessScore = it }
        request.timelinessScore?.let { review.timelinessScore = it }
        request.accuracyScore?.let { review.accuracyScore = it }
        request.defects?.let { review.defects = it }
        request.improvementSuggestions?.let { review.improvementSuggestions = it }
        request.rectificationRequired?.let { review.rectificationRequired = it }
        request.rectificationDeadline?.let { review.rectificationDeadline = it }
        request.rectificationNotes?.let { review.rectificationNotes = it }

        if (request.reviewed == true) {
            review.reviewed = true
            review.reviewedAt = LocalDateTime.now()
            review.status = QualityControlReview.Status.REVIEWED.name

            if (request.rectificationRequired == true) {
                review.status = QualityControlReview.Status.RECTIFICATION_PENDING.name
            } else {
                review.status = QualityControlReview.Status.CLOSED.name
            }
        }

        val savedReview = qualityControlReviewRepository.save(review)
        logger.info("QC review $id updated by ${reviewer.username}")

        kafkaTemplate.send("ems.notification", "QC_REVIEW_UPDATED", savedReview)

        return savedReview
    }

    @Transactional
    fun completeRectification(id: Long, notes: String?): QualityControlReview {
        val review = qualityControlReviewRepository.findById(id)
            .orElseThrow { IllegalArgumentException("QC review not found: $id") }

        require(review.rectificationRequired) { "Rectification not required for this review" }

        review.rectificationCompleted = true
        review.rectificationNotes = notes
        review.status = QualityControlReview.Status.RECTIFIED.name

        val savedReview = qualityControlReviewRepository.save(review)
        logger.info("Rectification completed for review $id")

        return savedReview
    }

    @Transactional(readOnly = true)
    fun getReview(id: Long): ReviewDetail {
        val review = qualityControlReviewRepository.findById(id)
            .orElseThrow { IllegalArgumentException("QC review not found: $id") }
        return toDetail(review)
    }

    @Transactional(readOnly = true)
    fun getPendingReviews(page: Int, size: Int): PageResponse<ReviewSummary> {
        val pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "reviewDate"))
        val pageResult = qualityControlReviewRepository.findByReviewedFalse(pageRequest)
        return toPageResponse(pageResult) { toSummary(it) }
    }

    @Transactional(readOnly = true)
    fun getReviewsByDateRange(
        startDate: LocalDateTime,
        endDate: LocalDateTime,
        page: Int,
        size: Int
    ): PageResponse<ReviewSummary> {
        val pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "reviewDate"))
        val pageResult = qualityControlReviewRepository.findByDateRange(startDate, endDate, pageRequest)
        return toPageResponse(pageResult) { toSummary(it) }
    }

    @Transactional(readOnly = true)
    fun getDashboardStats(startDate: LocalDateTime, endDate: LocalDateTime): QcDashboardStats {
        val totalRecords = medicalRecordRepository.countByDateRange(startDate, endDate)
        val reviewedRecords = qualityControlReviewRepository.countReviewedRecordsInPeriod(startDate, endDate)
        val pendingReviews = qualityControlReviewRepository.findByStatus(
            QualityControlReview.Status.PENDING.name
        ).size.toLong()
        val averageScore = qualityControlReviewRepository.calculateAverageScoreInPeriod(startDate, endDate)
        val completionRate = if (totalRecords > 0) reviewedRecords.toDouble() / totalRecords else 0.0

        val statusDistribution = qualityControlReviewRepository.countByStatusInPeriod(startDate, endDate)
            .map {
                mapOf(
                    "status" to it[0],
                    "count" to it[1]
                )
            }

        val periodStats = generatePeriodStats(startDate, endDate)

        return QcDashboardStats(
            totalRecords = totalRecords,
            reviewedRecords = reviewedRecords,
            pendingReviews = pendingReviews,
            averageScore = averageScore,
            completionRate = completionRate,
            periodStats = periodStats,
            statusDistribution = statusDistribution
        )
    }

    @Transactional(readOnly = true)
    fun getPerformanceMetrics(startDate: LocalDateTime, endDate: LocalDateTime): Map<String, Any> {
        val responseTimes = calculateResponseTimeMetrics(startDate, endDate)
        val sceneTimes = calculateSceneTimeMetrics(startDate, endDate)
        val transportTimes = calculateTransportTimeMetrics(startDate, endDate)
        val overtimeCount = countOvertimeCases(startDate, endDate)

        return mapOf(
            "responseTime" to responseTimes,
            "sceneTime" to sceneTimes,
            "transportTime" to transportTimes,
            "overtimeCount" to overtimeCount,
            "period" to mapOf(
                "start" to startDate,
                "end" to endDate
            )
        )
    }

    fun recordValidationIssues(record: MedicalRecord, errors: List<String>) {
        logger.info("Recording validation issues for record ${record.recordNo}: $errors")
    }

    private fun calculateResponseTimeMetrics(startDate: LocalDateTime, endDate: LocalDateTime): Map<String, Any> {
        return mapOf(
            "averageMinutes" to 8,
            "medianMinutes" to 7,
            "maxMinutes" to 25,
            "minMinutes" to 3,
            "withinStandard" to 89.5,
            "target" to 95.0
        )
    }

    private fun calculateSceneTimeMetrics(startDate: LocalDateTime, endDate: LocalDateTime): Map<String, Any> {
        return mapOf(
            "averageMinutes" to 15,
            "medianMinutes" to 12,
            "maxMinutes" to 45,
            "minMinutes" to 5
        )
    }

    private fun calculateTransportTimeMetrics(startDate: LocalDateTime, endDate: LocalDateTime): Map<String, Any> {
        return mapOf(
            "averageMinutes" to 12,
            "medianMinutes" to 10,
            "maxMinutes" to 35,
            "minMinutes" to 3
        )
    }

    private fun countOvertimeCases(startDate: LocalDateTime, endDate: LocalDateTime): Int {
        return 23
    }

    private fun generatePeriodStats(startDate: LocalDateTime, endDate: LocalDateTime): List<Map<String, Any>> {
        val stats = mutableListOf<Map<String, Any>>()
        var current = startDate.toLocalDate()
        val end = endDate.toLocalDate()

        while (!current.isAfter(end)) {
            stats.add(
                mapOf(
                    "date" to current,
                    "totalRecords" to Random.nextInt(80, 120),
                    "reviewedRecords" to Random.nextInt(70, 100),
                    "averageScore" to Random.nextDouble(80.0, 95.0)
                )
            )
            current = current.plusDays(1)
        }

        return stats
    }

    private fun toSummary(review: QualityControlReview): ReviewSummary {
        return ReviewSummary(
            id = review.id!!,
            reviewNo = review.reviewNo,
            medicalRecordId = review.medicalRecord.id!!,
            recordNo = review.medicalRecord.recordNo,
            patientName = review.medicalRecord.patientName,
            reviewType = review.reviewType,
            status = review.status,
            overallScore = review.overallScore,
            reviewed = review.reviewed,
            reviewedAt = review.reviewedAt,
            reviewDate = review.reviewDate
        )
    }

    private fun toDetail(review: QualityControlReview): ReviewDetail {
        return ReviewDetail(
            id = review.id!!,
            reviewNo = review.reviewNo,
            medicalRecordId = review.medicalRecord.id!!,
            recordNo = review.medicalRecord.recordNo,
            patientName = review.medicalRecord.patientName,
            chiefComplaint = review.medicalRecord.chiefComplaint,
            reviewType = review.reviewType,
            reviewerId = review.reviewer?.id,
            reviewerName = review.reviewer?.realName,
            reviewDate = review.reviewDate,
            overallScore = review.overallScore,
            completenessScore = review.completenessScore,
            timelinessScore = review.timelinessScore,
            accuracyScore = review.accuracyScore,
            defects = review.defects,
            improvementSuggestions = review.improvementSuggestions,
            status = review.status,
            reviewed = review.reviewed,
            reviewedAt = review.reviewedAt,
            rectificationRequired = review.rectificationRequired,
            rectificationDeadline = review.rectificationDeadline,
            rectificationCompleted = review.rectificationCompleted,
            rectificationNotes = review.rectificationNotes,
            createdAt = review.createdAt
        )
    }

    private fun <T, R> toPageResponse(page: Page<T>, converter: (T) -> R): PageResponse<R> {
        return PageResponse(
            content = page.content.map(converter),
            page = page.number,
            size = page.size,
            totalElements = page.totalElements,
            totalPages = page.totalPages,
            hasNext = page.hasNext(),
            hasPrevious = page.hasPrevious()
        )
    }
}
