package com.ems.dispatch.entity

import jakarta.persistence.*
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.LocalDate
import java.time.LocalDateTime

@Entity
@Table(name = "medical_supplies")
@EntityListeners(AuditingEntityListener::class)
class MedicalSupply(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ambulance_id")
    var ambulance: Ambulance? = null,

    @Column(name = "item_code", nullable = false, length = 50)
    var itemCode: String,

    @Column(name = "item_name", nullable = false, length = 200)
    var itemName: String,

    @Column(nullable = false, length = 50)
    var category: String,

    @Column(length = 200)
    var specification: String? = null,

    @Column(nullable = false, length = 20)
    var unit: String,

    @Column(nullable = false)
    var quantity: Int = 0,

    @Column(name = "minimum_stock", nullable = false)
    var minimumStock: Int = 10,

    @Column(name = "expiry_date")
    var expiryDate: LocalDate? = null,

    @Column(name = "batch_no", length = 50)
    var batchNo: String? = null,

    @Column(length = 200)
    var manufacturer: String? = null,

    @Column(name = "last_restock_date")
    var lastRestockDate: LocalDate? = null,

    @Column(name = "last_restock_quantity")
    var lastRestockQuantity: Int? = null,

    @Column(nullable = false, length = 20)
    var status: String = "NORMAL",

    @Column(columnDefinition = "TEXT")
    var remarks: String? = null,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(),

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
) {
    enum class Category {
        MEDICATION, EQUIPMENT, DISPOSABLE, OXYGEN, BANDAGE, INSTRUMENT, OTHER
    }

    enum class Status {
        NORMAL, LOW_STOCK, EXPIRED, OUT_OF_STOCK, RESERVED
    }
}
