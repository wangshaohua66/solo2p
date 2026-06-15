package com.ems.dispatch.entity

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import org.springframework.data.annotation.CreatedBy
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedBy
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.math.BigDecimal
import java.time.LocalDateTime

@Entity
@Table(name = "medical_records")
@EntityListeners(AuditingEntityListener::class)
class MedicalRecord(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(name = "record_no", nullable = false, unique = true, length = 50)
    var recordNo: String,

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dispatch_event_id", nullable = false)
    var dispatchEvent: DispatchEvent,

    @Column(name = "patient_name", nullable = false, length = 100)
    var patientName: String,

    @Column(name = "patient_gender", length = 10)
    var patientGender: String? = null,

    @Column(name = "patient_age")
    var patientAge: Int? = null,

    @Column(name = "patient_id_card", length = 20)
    var patientIdCard: String? = null,

    @Column(name = "chief_complaint", length = 500)
    var chiefComplaint: String? = null,

    @Column(name = "present_illness", columnDefinition = "TEXT")
    var presentIllness: String? = null,

    @Column(name = "past_history", columnDefinition = "TEXT")
    var pastHistory: String? = null,

    @Column(name = "allergy_history", columnDefinition = "TEXT")
    var allergyHistory: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "vital_signs", columnDefinition = "jsonb")
    var vitalSigns: Map<String, Any>? = null,

    @Column(name = "physical_examination", columnDefinition = "TEXT")
    var physicalExamination: String? = null,

    @Column(name = "auxiliary_examination", columnDefinition = "TEXT")
    var auxiliaryExamination: String? = null,

    @Column(name = "preliminary_diagnosis", length = 500)
    var preliminaryDiagnosis: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "treatment_measures", columnDefinition = "jsonb")
    var treatmentMeasures: List<Map<String, Any>>? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "medications", columnDefinition = "jsonb")
    var medications: List<Map<String, Any>>? = null,

    @Column(name = "procedures_performed", columnDefinition = "TEXT")
    var proceduresPerformed: String? = null,

    @Column(length = 50)
    var consciousness: String? = null,

    @Column(length = 50)
    var breathing: String? = null,

    @Column(length = 50)
    var circulation: String? = null,

    @Column(name = "glasgow_score")
    var glasgowScore: Int? = null,

    @Column(name = "ecg_monitoring")
    var ecgMonitoring: Boolean = false,

    @Column(name = "oxygen_saturation")
    var oxygenSaturation: Int? = null,

    @Column(name = "blood_pressure_systolic")
    var bloodPressureSystolic: Int? = null,

    @Column(name = "blood_pressure_diastolic")
    var bloodPressureDiastolic: Int? = null,

    @Column(name = "heart_rate")
    var heartRate: Int? = null,

    @Column(name = "respiratory_rate")
    var respiratoryRate: Int? = null,

    var temperature: BigDecimal? = null,

    @Column(name = "blood_glucose")
    var bloodGlucose: BigDecimal? = null,

    @Column(length = 50)
    var outcome: String? = null,

    @Column(name = "is_locked", nullable = false)
    var isLocked: Boolean = false,

    @Column(name = "locked_at")
    var lockedAt: LocalDateTime? = null,

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
    var updatedBy: Long? = null,

    @OneToMany(mappedBy = "medicalRecord", cascade = [CascadeType.ALL])
    var qualityControlReviews: MutableList<QualityControlReview> = mutableListOf()
)
