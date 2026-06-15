package com.ems.dispatch.service

import com.ems.dispatch.dto.PageResponse
import com.ems.dispatch.entity.Ambulance
import com.ems.dispatch.entity.MedicalSupply
import com.ems.dispatch.entity.VehicleMaintenance
import com.ems.dispatch.repository.AmbulanceRepository
import com.ems.dispatch.repository.MedicalSupplyRepository
import com.ems.dispatch.repository.VehicleMaintenanceRepository
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.LocalDateTime

@Service
class VehicleManagementService(
    private val ambulanceRepository: AmbulanceRepository,
    private val vehicleMaintenanceRepository: VehicleMaintenanceRepository,
    private val medicalSupplyRepository: MedicalSupplyRepository,
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    private val messagingTemplate: SimpMessagingTemplate
) {
    private val logger = LoggerFactory.getLogger(VehicleManagementService::class.java)

    data class AmbulanceCreateRequest(
        val vehicleNo: String,
        val vehicleType: String,
        val equipmentLevel: String,
        val driverName: String? = null,
        val driverPhone: String? = null,
        val longitude: Double? = null,
        val latitude: Double? = null
    )

    data class AmbulanceUpdateRequest(
        val vehicleType: String? = null,
        val equipmentLevel: String? = null,
        val status: String? = null,
        val driverName: String? = null,
        val driverPhone: String? = null,
        val currentStationId: Long? = null
    )

    data class AmbulanceDto(
        val id: Long,
        val vehicleNo: String,
        val vehicleType: String,
        val equipmentLevel: String,
        val status: String,
        val driverName: String?,
        val driverPhone: String?,
        val mileage: Int,
        val fuelLevel: Int,
        val lastMaintenanceDate: LocalDate?,
        val nextMaintenanceDate: LocalDate?,
        val currentLocation: com.ems.dispatch.dto.LocationDto?,
        val createdAt: LocalDateTime
    )

    data class MaintenanceCreateRequest(
        val ambulanceId: Long,
        val maintenanceType: String,
        val maintenanceDate: LocalDate,
        val mileageAtService: Int,
        val description: String? = null,
        val serviceCost: java.math.BigDecimal? = null,
        val serviceStation: String? = null,
        val nextMaintenanceDate: LocalDate? = null,
        val nextMileageThreshold: Int? = null
    )

    data class SupplyCreateRequest(
        val ambulanceId: Long? = null,
        val itemCode: String,
        val itemName: String,
        val category: String,
        val specification: String? = null,
        val unit: String,
        val quantity: Int,
        val minimumStock: Int = 10,
        val expiryDate: LocalDate? = null,
        val batchNo: String? = null,
        val manufacturer: String? = null
    )

    data class SupplyUpdateRequest(
        val quantity: Int? = null,
        val minimumStock: Int? = null,
        val expiryDate: LocalDate? = null,
        val status: String? = null,
        val remarks: String? = null
    )

    data class SupplyDto(
        val id: Long,
        val ambulanceId: Long?,
        val vehicleNo: String?,
        val itemCode: String,
        val itemName: String,
        val category: String,
        val specification: String?,
        val unit: String,
        val quantity: Int,
        val minimumStock: Int,
        val status: String,
        val expiryDate: LocalDate?,
        val lastRestockDate: LocalDate?,
        val createdAt: LocalDateTime
    )

    @Transactional
    fun createAmbulance(request: AmbulanceCreateRequest): AmbulanceDto {
        require(!ambulanceRepository.existsByVehicleNo(request.vehicleNo)) {
            "Vehicle number ${request.vehicleNo} already exists"
        }

        val ambulance = Ambulance(
            vehicleNo = request.vehicleNo,
            vehicleType = request.vehicleType,
            equipmentLevel = request.equipmentLevel,
            driverName = request.driverName,
            driverPhone = request.driverPhone
        )

        if (request.longitude != null && request.latitude != null) {
            ambulance.currentLocation = com.ems.dispatch.util.GisUtils.createPoint(
                request.longitude, request.latitude
            )
        }

        val saved = ambulanceRepository.save(ambulance)
        logger.info("Ambulance created: ${saved.vehicleNo}")

        kafkaTemplate.send("ems.dispatch.event", "VEHICLE_CREATED", saved)

        return toAmbulanceDto(saved)
    }

    @Transactional
    fun updateAmbulance(id: Long, request: AmbulanceUpdateRequest): AmbulanceDto {
        val ambulance = ambulanceRepository.findById(id)
            .orElseThrow { IllegalArgumentException("Ambulance not found: $id") }

        request.vehicleType?.let { ambulance.vehicleType = it }
        request.equipmentLevel?.let { ambulance.equipmentLevel = it }
        request.status?.let { ambulance.status = it }
        request.driverName?.let { ambulance.driverName = it }
        request.driverPhone?.let { ambulance.driverPhone = it }
        request.currentStationId?.let { ambulance.currentStationId = it }

        val saved = ambulanceRepository.save(ambulance)
        logger.info("Ambulance ${saved.vehicleNo} updated")

        messagingTemplate.convertAndSend("/topic/vehicle/update", toAmbulanceDto(saved))

        return toAmbulanceDto(saved)
    }

    @Transactional(readOnly = true)
    fun getAmbulance(id: Long): AmbulanceDto {
        val ambulance = ambulanceRepository.findById(id)
            .orElseThrow { IllegalArgumentException("Ambulance not found: $id") }
        return toAmbulanceDto(ambulance)
    }

    @Transactional(readOnly = true)
    fun getAllAmbulances(status: String? = null, page: Int, size: Int): PageResponse<AmbulanceDto> {
        val pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "vehicleNo"))
        val pageResult = if (status != null) {
            val list = ambulanceRepository.findByStatus(status)
            org.springframework.data.domain.PageImpl(list, pageRequest, list.size.toLong())
        } else {
            ambulanceRepository.findAll(pageRequest)
        }
        return toPageResponse(pageResult) { toAmbulanceDto(it) }
    }

    @Transactional
    fun createMaintenance(request: MaintenanceCreateRequest): VehicleMaintenance {
        val ambulance = ambulanceRepository.findById(request.ambulanceId)
            .orElseThrow { IllegalArgumentException("Ambulance not found: ${request.ambulanceId}") }

        val maintenance = VehicleMaintenance(
            ambulance = ambulance,
            maintenanceType = request.maintenanceType,
            maintenanceDate = request.maintenanceDate,
            mileageAtService = request.mileageAtService,
            description = request.description,
            serviceCost = request.serviceCost,
            serviceStation = request.serviceStation,
            nextMaintenanceDate = request.nextMaintenanceDate,
            nextMileageThreshold = request.nextMileageThreshold
        )

        val saved = vehicleMaintenanceRepository.save(maintenance)

        ambulance.lastMaintenanceDate = request.maintenanceDate
        ambulance.nextMaintenanceDate = request.nextMaintenanceDate
        ambulanceRepository.save(ambulance)

        logger.info("Maintenance record created for ambulance ${ambulance.vehicleNo}")

        return saved
    }

    @Transactional(readOnly = true)
    fun getMaintenanceHistory(ambulanceId: Long): List<VehicleMaintenance> {
        return vehicleMaintenanceRepository.findByAmbulanceIdOrderByMaintenanceDateDesc(ambulanceId)
    }

    @Scheduled(cron = "0 0 1 * * ?")
    @Transactional
    fun checkMaintenanceDue() {
        val today = LocalDate.now()
        val dueVehicles = vehicleMaintenanceRepository.findDueForMaintenance(today.plusDays(7))

        dueVehicles.forEach { maintenance ->
            val ambulance = maintenance.ambulance
            logger.warn("Maintenance due for ambulance ${ambulance.vehicleNo}")

            val alert = mapOf(
                "type" to "MAINTENANCE_DUE",
                "ambulanceId" to ambulance.id,
                "vehicleNo" to ambulance.vehicleNo,
                "dueDate" to maintenance.nextMaintenanceDate,
                "currentMileage" to ambulance.mileage,
                "threshold" to maintenance.nextMileageThreshold
            )
            kafkaTemplate.send("ems.notification", "MAINTENANCE_ALERT", alert)
            messagingTemplate.convertAndSend("/topic/vehicle/maintenance-alert", alert)
        }

        logger.info("Maintenance check completed: ${dueVehicles.size} vehicles due")
    }

    @Transactional
    fun createSupply(request: SupplyCreateRequest): SupplyDto {
        val ambulance = request.ambulanceId?.let {
            ambulanceRepository.findById(it)
                .orElseThrow { IllegalArgumentException("Ambulance not found: $it") }
        }

        val supply = MedicalSupply(
            ambulance = ambulance,
            itemCode = request.itemCode,
            itemName = request.itemName,
            category = request.category,
            specification = request.specification,
            unit = request.unit,
            quantity = request.quantity,
            minimumStock = request.minimumStock,
            expiryDate = request.expiryDate,
            batchNo = request.batchNo,
            manufacturer = request.manufacturer
        )

        updateSupplyStatus(supply)
        val saved = medicalSupplyRepository.save(supply)

        logger.info("Supply created: ${saved.itemName} for ambulance ${ambulance?.vehicleNo}")

        return toSupplyDto(saved)
    }

    @Transactional
    fun updateSupply(id: Long, request: SupplyUpdateRequest): SupplyDto {
        val supply = medicalSupplyRepository.findById(id)
            .orElseThrow { IllegalArgumentException("Supply not found: $id") }

        request.quantity?.let {
            supply.quantity = it
            supply.lastRestockDate = LocalDate.now()
            supply.lastRestockQuantity = it
        }
        request.minimumStock?.let { supply.minimumStock = it }
        request.expiryDate?.let { supply.expiryDate = it }
        request.status?.let { supply.status = it }
        request.remarks?.let { supply.remarks = it }

        updateSupplyStatus(supply)
        val saved = medicalSupplyRepository.save(supply)

        return toSupplyDto(saved)
    }

    @Transactional(readOnly = true)
    fun getSupplies(ambulanceId: Long? = null, category: String? = null, status: String? = null): List<SupplyDto> {
        val supplies = when {
            ambulanceId != null && category != null ->
                medicalSupplyRepository.findByAmbulanceIdAndCategory(ambulanceId, category)
            ambulanceId != null -> medicalSupplyRepository.findByAmbulanceId(ambulanceId)
            category != null -> medicalSupplyRepository.findByCategory(category)
            status != null -> medicalSupplyRepository.findByStatus(status)
            else -> medicalSupplyRepository.findAll()
        }
        return supplies.map { toSupplyDto(it) }
    }

    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional
    fun checkSupplyAlerts() {
        val lowStockItems = medicalSupplyRepository.findLowStockItems()
        val expiringItems = medicalSupplyRepository.findExpiringItems(LocalDate.now().plusDays(30))

        lowStockItems.forEach { supply ->
            val alert = mapOf(
                "type" to "LOW_STOCK",
                "supplyId" to supply.id,
                "itemName" to supply.itemName,
                "vehicleNo" to supply.ambulance?.vehicleNo,
                "quantity" to supply.quantity,
                "minimumStock" to supply.minimumStock
            )
            kafkaTemplate.send("ems.notification", "SUPPLY_ALERT", alert)
            messagingTemplate.convertAndSend("/topic/supply/alert", alert)
        }

        expiringItems.forEach { supply ->
            val alert = mapOf(
                "type" to "EXPIRING",
                "supplyId" to supply.id,
                "itemName" to supply.itemName,
                "expiryDate" to supply.expiryDate,
                "daysRemaining" to java.time.temporal.ChronoUnit.DAYS.between(
                    LocalDate.now(), supply.expiryDate
                )
            )
            kafkaTemplate.send("ems.notification", "SUPPLY_EXPIRY_ALERT", alert)
        }

        logger.info("Supply check completed: ${lowStockItems.size} low stock, ${expiringItems.size} expiring")
    }

    private fun updateSupplyStatus(supply: MedicalSupply) {
        val today = LocalDate.now()

        if (supply.quantity <= 0) {
            supply.status = MedicalSupply.Status.OUT_OF_STOCK.name
        } else if (supply.expiryDate != null && supply.expiryDate!!.isBefore(today)) {
            supply.status = MedicalSupply.Status.EXPIRED.name
        } else if (supply.quantity <= supply.minimumStock) {
            supply.status = MedicalSupply.Status.LOW_STOCK.name
        } else {
            supply.status = MedicalSupply.Status.NORMAL.name
        }
    }

    private fun toAmbulanceDto(ambulance: Ambulance): AmbulanceDto {
        return AmbulanceDto(
            id = ambulance.id!!,
            vehicleNo = ambulance.vehicleNo,
            vehicleType = ambulance.vehicleType,
            equipmentLevel = ambulance.equipmentLevel,
            status = ambulance.status,
            driverName = ambulance.driverName,
            driverPhone = ambulance.driverPhone,
            mileage = ambulance.mileage,
            fuelLevel = ambulance.fuelLevel,
            lastMaintenanceDate = ambulance.lastMaintenanceDate,
            nextMaintenanceDate = ambulance.nextMaintenanceDate,
            currentLocation = com.ems.dispatch.util.GisUtils.toLocationDto(ambulance.currentLocation),
            createdAt = ambulance.createdAt
        )
    }

    private fun toSupplyDto(supply: MedicalSupply): SupplyDto {
        return SupplyDto(
            id = supply.id!!,
            ambulanceId = supply.ambulance?.id,
            vehicleNo = supply.ambulance?.vehicleNo,
            itemCode = supply.itemCode,
            itemName = supply.itemName,
            category = supply.category,
            specification = supply.specification,
            unit = supply.unit,
            quantity = supply.quantity,
            minimumStock = supply.minimumStock,
            status = supply.status,
            expiryDate = supply.expiryDate,
            lastRestockDate = supply.lastRestockDate,
            createdAt = supply.createdAt
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
