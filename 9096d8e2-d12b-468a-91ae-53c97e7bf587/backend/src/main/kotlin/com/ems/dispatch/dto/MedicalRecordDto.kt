package com.ems.dispatch.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import java.math.BigDecimal
import java.time.LocalDateTime

data class MedicalRecordCreateRequest(
    @field:NotNull(message = "Dispatch event ID is required")
    val dispatchEventId: Long,
    @field:NotBlank(message = "Patient name is required")
    val patientName: String,
    val patientGender: String? = null,
    val patientAge: Int? = null,
    val patientIdCard: String? = null,
    val chiefComplaint: String? = null,
    val presentIllness: String? = null,
    val pastHistory: String? = null,
    val allergyHistory: String? = null,
    val vitalSigns: Map<String, Any>? = null,
    val physicalExamination: String? = null,
    val auxiliaryExamination: String? = null,
    val preliminaryDiagnosis: String? = null,
    val treatmentMeasures: List<Map<String, Any>>? = null,
    val medications: List<Map<String, Any>>? = null,
    val proceduresPerformed: String? = null,
    val consciousness: String? = null,
    val breathing: String? = null,
    val circulation: String? = null,
    val glasgowScore: Int? = null,
    val ecgMonitoring: Boolean = false,
    val oxygenSaturation: Int? = null,
    val bloodPressureSystolic: Int? = null,
    val bloodPressureDiastolic: Int? = null,
    val heartRate: Int? = null,
    val respiratoryRate: Int? = null,
    val temperature: BigDecimal? = null,
    val bloodGlucose: BigDecimal? = null,
    val outcome: String? = null
)

data class MedicalRecordUpdateRequest(
    val chiefComplaint: String? = null,
    val presentIllness: String? = null,
    val pastHistory: String? = null,
    val allergyHistory: String? = null,
    val vitalSigns: Map<String, Any>? = null,
    val physicalExamination: String? = null,
    val auxiliaryExamination: String? = null,
    val preliminaryDiagnosis: String? = null,
    val treatmentMeasures: List<Map<String, Any>>? = null,
    val medications: List<Map<String, Any>>? = null,
    val proceduresPerformed: String? = null,
    val consciousness: String? = null,
    val breathing: String? = null,
    val circulation: String? = null,
    val glasgowScore: Int? = null,
    val ecgMonitoring: Boolean? = null,
    val oxygenSaturation: Int? = null,
    val bloodPressureSystolic: Int? = null,
    val bloodPressureDiastolic: Int? = null,
    val heartRate: Int? = null,
    val respiratoryRate: Int? = null,
    val temperature: BigDecimal? = null,
    val bloodGlucose: BigDecimal? = null,
    val outcome: String? = null
)

data class MedicalRecordSummary(
    val id: Long,
    val recordNo: String,
    val dispatchEventId: Long,
    val eventNo: String,
    val patientName: String,
    val patientGender: String?,
    val patientAge: Int?,
    val chiefComplaint: String?,
    val preliminaryDiagnosis: String?,
    val isLocked: Boolean,
    val createdAt: LocalDateTime,
    val createdBy: String?
)

data class MedicalRecordDetail(
    val id: Long,
    val recordNo: String,
    val dispatchEventId: Long,
    val eventNo: String,
    val patientName: String,
    val patientGender: String?,
    val patientAge: Int?,
    val patientIdCard: String?,
    val chiefComplaint: String?,
    val presentIllness: String?,
    val pastHistory: String?,
    val allergyHistory: String?,
    val vitalSigns: Map<String, Any>?,
    val physicalExamination: String?,
    val auxiliaryExamination: String?,
    val preliminaryDiagnosis: String?,
    val treatmentMeasures: List<Map<String, Any>>?,
    val medications: List<Map<String, Any>>?,
    val proceduresPerformed: String?,
    val consciousness: String?,
    val breathing: String?,
    val circulation: String?,
    val glasgowScore: Int?,
    val ecgMonitoring: Boolean,
    val oxygenSaturation: Int?,
    val bloodPressureSystolic: Int?,
    val bloodPressureDiastolic: Int?,
    val heartRate: Int?,
    val respiratoryRate: Int?,
    val temperature: BigDecimal?,
    val bloodGlucose: BigDecimal?,
    val outcome: String?,
    val isLocked: Boolean,
    val lockedAt: LocalDateTime?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
    val createdBy: String?,
    val updatedBy: String?
)

data class VitalSignsDto(
    val heartRate: Int?,
    val bloodPressureSystolic: Int?,
    val bloodPressureDiastolic: Int?,
    val respiratoryRate: Int?,
    val oxygenSaturation: Int?,
    val temperature: BigDecimal?,
    val bloodGlucose: BigDecimal?,
    val timestamp: LocalDateTime
)
