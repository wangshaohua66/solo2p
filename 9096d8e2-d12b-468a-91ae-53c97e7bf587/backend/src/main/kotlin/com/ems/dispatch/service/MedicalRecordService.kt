package com.ems.dispatch.service

import com.ems.dispatch.dto.*
import com.ems.dispatch.entity.MedicalRecord
import com.ems.dispatch.entity.User
import com.ems.dispatch.repository.DispatchEventRepository
import com.ems.dispatch.repository.MedicalRecordRepository
import com.ems.dispatch.util.EventNoGenerator
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
class MedicalRecordService(
    private val medicalRecordRepository: MedicalRecordRepository,
    private val dispatchEventRepository: DispatchEventRepository,
    private val eventNoGenerator: EventNoGenerator,
    private val qualityControlService: QualityControlService,
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    private val messagingTemplate: SimpMessagingTemplate
) {
    private val logger = LoggerFactory.getLogger(MedicalRecordService::class.java)

    @Transactional
    fun createRecord(request: MedicalRecordCreateRequest, doctor: User): MedicalRecordDetail {
        logger.info("Creating medical record for event: ${request.dispatchEventId}")

        val event = dispatchEventRepository.findById(request.dispatchEventId)
            .orElseThrow { IllegalArgumentException("Dispatch event not found: ${request.dispatchEventId}") }

        val existingRecord = medicalRecordRepository.findByDispatchEventId(request.dispatchEventId)
        require(existingRecord == null) { "Medical record already exists for this event" }

        val recordNo = eventNoGenerator.generateRecordNo()

        val record = MedicalRecord(
            recordNo = recordNo,
            dispatchEvent = event,
            patientName = request.patientName,
            patientGender = request.patientGender,
            patientAge = request.patientAge,
            patientIdCard = request.patientIdCard,
            chiefComplaint = request.chiefComplaint ?: event.chiefComplaint,
            presentIllness = request.presentIllness,
            pastHistory = request.pastHistory,
            allergyHistory = request.allergyHistory,
            vitalSigns = request.vitalSigns,
            physicalExamination = request.physicalExamination,
            auxiliaryExamination = request.auxiliaryExamination,
            preliminaryDiagnosis = request.preliminaryDiagnosis,
            treatmentMeasures = request.treatmentMeasures,
            medications = request.medications,
            proceduresPerformed = request.proceduresPerformed,
            consciousness = request.consciousness,
            breathing = request.breathing,
            circulation = request.circulation,
            glasgowScore = request.glasgowScore,
            ecgMonitoring = request.ecgMonitoring,
            oxygenSaturation = request.oxygenSaturation,
            bloodPressureSystolic = request.bloodPressureSystolic,
            bloodPressureDiastolic = request.bloodPressureDiastolic,
            heartRate = request.heartRate,
            respiratoryRate = request.respiratoryRate,
            temperature = request.temperature,
            bloodGlucose = request.bloodGlucose,
            outcome = request.outcome,
            createdBy = doctor.id
        )

        val savedRecord = medicalRecordRepository.save(record)
        logger.info("Medical record created with recordNo: $recordNo")

        kafkaTemplate.send("ems.medical.record", "CREATED", savedRecord)
        messagingTemplate.convertAndSend("/topic/medical-record/new", toSummary(savedRecord))

        validateRecord(savedRecord)

        return toDetail(savedRecord)
    }

    @Transactional
    fun updateRecord(id: Long, request: MedicalRecordUpdateRequest, doctor: User): MedicalRecordDetail {
        val record = medicalRecordRepository.findById(id)
            .orElseThrow { IllegalArgumentException("Medical record not found: $id") }

        require(!record.isLocked) { "Medical record is locked and cannot be modified" }

        request.chiefComplaint?.let { record.chiefComplaint = it }
        request.presentIllness?.let { record.presentIllness = it }
        request.pastHistory?.let { record.pastHistory = it }
        request.allergyHistory?.let { record.allergyHistory = it }
        request.vitalSigns?.let { record.vitalSigns = it }
        request.physicalExamination?.let { record.physicalExamination = it }
        request.auxiliaryExamination?.let { record.auxiliaryExamination = it }
        request.preliminaryDiagnosis?.let { record.preliminaryDiagnosis = it }
        request.treatmentMeasures?.let { record.treatmentMeasures = it }
        request.medications?.let { record.medications = it }
        request.proceduresPerformed?.let { record.proceduresPerformed = it }
        request.consciousness?.let { record.consciousness = it }
        request.breathing?.let { record.breathing = it }
        request.circulation?.let { record.circulation = it }
        request.glasgowScore?.let { record.glasgowScore = it }
        request.ecgMonitoring?.let { record.ecgMonitoring = it }
        request.oxygenSaturation?.let { record.oxygenSaturation = it }
        request.bloodPressureSystolic?.let { record.bloodPressureSystolic = it }
        request.bloodPressureDiastolic?.let { record.bloodPressureDiastolic = it }
        request.heartRate?.let { record.heartRate = it }
        request.respiratoryRate?.let { record.respiratoryRate = it }
        request.temperature?.let { record.temperature = it }
        request.bloodGlucose?.let { record.bloodGlucose = it }
        request.outcome?.let { record.outcome = it }

        record.updatedBy = doctor.id

        val savedRecord = medicalRecordRepository.save(record)
        logger.info("Medical record $id updated by ${doctor.username}")

        kafkaTemplate.send("ems.medical.record", "UPDATED", savedRecord)
        messagingTemplate.convertAndSend("/topic/medical-record/update", toSummary(savedRecord))

        validateRecord(savedRecord)

        return toDetail(savedRecord)
    }

    @Transactional
    fun lockRecord(id: Long, doctor: User): MedicalRecordDetail {
        val record = medicalRecordRepository.findById(id)
            .orElseThrow { IllegalArgumentException("Medical record not found: $id") }

        require(!record.isLocked) { "Medical record is already locked" }

        record.isLocked = true
        record.lockedAt = LocalDateTime.now()
        record.updatedBy = doctor.id

        val savedRecord = medicalRecordRepository.save(record)
        logger.info("Medical record $id locked by ${doctor.username}")

        kafkaTemplate.send("ems.medical.record", "LOCKED", savedRecord)
        messagingTemplate.convertAndSend("/topic/medical-record/locked", toSummary(savedRecord))

        qualityControlService.scheduleAutoReview(savedRecord)

        return toDetail(savedRecord)
    }

    @Transactional(readOnly = true)
    fun getRecord(id: Long): MedicalRecordDetail {
        val record = medicalRecordRepository.findById(id)
            .orElseThrow { IllegalArgumentException("Medical record not found: $id") }
        return toDetail(record)
    }

    @Transactional(readOnly = true)
    fun getRecordsByDateRange(
        startDate: LocalDateTime,
        endDate: LocalDateTime,
        page: Int,
        size: Int
    ): PageResponse<MedicalRecordSummary> {
        val pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        val pageResult = medicalRecordRepository.findByDateRange(startDate, endDate, pageRequest)
        return toPageResponse(pageResult) { toSummary(it) }
    }

    @Transactional(readOnly = true)
    fun getRecordsPendingReview(page: Int, size: Int): PageResponse<MedicalRecordSummary> {
        val pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        val pageResult = medicalRecordRepository.findRecordsPendingReview(pageRequest)
        return toPageResponse(pageResult) { toSummary(it) }
    }

    @Transactional(readOnly = true)
    fun getStatistics(startDate: LocalDateTime, endDate: LocalDateTime): Map<String, Any> {
        val totalRecords = medicalRecordRepository.countByDateRange(startDate, endDate)
        val lockedRecords = medicalRecordRepository.findByIsLockedTrue().size
        val diagnosisStats = medicalRecordRepository.countByDiagnosisInPeriod(
            startDate, endDate, PageRequest.of(0, 10)
        ).map {
            mapOf(
                "diagnosis" to it[0],
                "count" to it[1]
            )
        }

        return mapOf(
            "totalRecords" to totalRecords,
            "lockedRecords" to lockedRecords,
            "pendingReview" to (totalRecords - lockedRecords),
            "topDiagnoses" to diagnosisStats,
            "period" to mapOf(
                "start" to startDate,
                "end" to endDate
            )
        )
    }

    private fun validateRecord(record: MedicalRecord): List<String> {
        val errors = mutableListOf<String>()

        if (record.chiefComplaint.isNullOrBlank()) {
            errors.add("Chief complaint is required")
        }
        if (record.preliminaryDiagnosis.isNullOrBlank()) {
            errors.add("Preliminary diagnosis is required")
        }
        if (record.heartRate == null && record.respiratoryRate == null && record.bloodPressureSystolic == null) {
            errors.add("At least one vital sign should be recorded")
        }

        if (errors.isNotEmpty()) {
            logger.warn("Medical record ${record.recordNo} validation errors: $errors")
            qualityControlService.recordValidationIssues(record, errors)
        }

        return errors
    }

    private fun toSummary(record: MedicalRecord): MedicalRecordSummary {
        return MedicalRecordSummary(
            id = record.id!!,
            recordNo = record.recordNo,
            dispatchEventId = record.dispatchEvent.id!!,
            eventNo = record.dispatchEvent.eventNo,
            patientName = record.patientName,
            patientGender = record.patientGender,
            patientAge = record.patientAge,
            chiefComplaint = record.chiefComplaint,
            preliminaryDiagnosis = record.preliminaryDiagnosis,
            isLocked = record.isLocked,
            createdAt = record.createdAt,
            createdBy = null
        )
    }

    private fun toDetail(record: MedicalRecord): MedicalRecordDetail {
        return MedicalRecordDetail(
            id = record.id!!,
            recordNo = record.recordNo,
            dispatchEventId = record.dispatchEvent.id!!,
            eventNo = record.dispatchEvent.eventNo,
            patientName = record.patientName,
            patientGender = record.patientGender,
            patientAge = record.patientAge,
            patientIdCard = record.patientIdCard,
            chiefComplaint = record.chiefComplaint,
            presentIllness = record.presentIllness,
            pastHistory = record.pastHistory,
            allergyHistory = record.allergyHistory,
            vitalSigns = record.vitalSigns,
            physicalExamination = record.physicalExamination,
            auxiliaryExamination = record.auxiliaryExamination,
            preliminaryDiagnosis = record.preliminaryDiagnosis,
            treatmentMeasures = record.treatmentMeasures,
            medications = record.medications,
            proceduresPerformed = record.proceduresPerformed,
            consciousness = record.consciousness,
            breathing = record.breathing,
            circulation = record.circulation,
            glasgowScore = record.glasgowScore,
            ecgMonitoring = record.ecgMonitoring,
            oxygenSaturation = record.oxygenSaturation,
            bloodPressureSystolic = record.bloodPressureSystolic,
            bloodPressureDiastolic = record.bloodPressureDiastolic,
            heartRate = record.heartRate,
            respiratoryRate = record.respiratoryRate,
            temperature = record.temperature,
            bloodGlucose = record.bloodGlucose,
            outcome = record.outcome,
            isLocked = record.isLocked,
            lockedAt = record.lockedAt,
            createdAt = record.createdAt,
            updatedAt = record.updatedAt,
            createdBy = null,
            updatedBy = null
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
