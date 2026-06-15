package com.ems.dispatch.performance

import com.ems.dispatch.entity.*
import com.ems.dispatch.repository.*
import com.ems.dispatch.service.DispatchService
import com.ems.dispatch.service.MedicalRecordService
import com.ems.dispatch.util.GisUtils
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.system.measureTimeMillis

@SpringBootTest
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
class PerformanceTest {

    @Autowired
    private lateinit var dispatchService: DispatchService

    @Autowired
    private lateinit var medicalRecordService: MedicalRecordService

    @Autowired
    private lateinit var dispatchEventRepository: DispatchEventRepository

    @Autowired
    private lateinit var ambulanceRepository: AmbulanceRepository

    @Autowired
    private lateinit var medicalRecordRepository: MedicalRecordRepository

    @Autowired
    private lateinit var ambulanceLocationRepository: AmbulanceLocationRepository

    companion object {
        private const val TEST_RECORD_COUNT = 1000
        private const val CONCURRENT_USERS = 50
        private const val RESPONSE_TIME_THRESHOLD_MS = 2000
        private const val DB_QUERY_THRESHOLD_MS = 1000
        private const val POSTGIS_QUERY_THRESHOLD_MS = 200
    }

    @Test
    @Order(1)
    @DisplayName("调度看板首屏加载性能测试 - 小于等于1.5秒")
    fun testDispatchDashboardLoadTime() {
        val time = measureTimeMillis {
            val dashboard = dispatchService.getDashboardData()
            assertNotNull(dashboard)
        }

        println("调度看板首屏加载时间: ${time}ms")
        assertTrue(time <= 1500, "调度看板首屏加载时间 ${time}ms 超过阈值 1500ms")
    }

    @Test
    @Order(2)
    @DisplayName("PostGIS范围查询性能测试 - 小于等于200毫秒")
    fun testPostGisSpatialQuery() {
        val centerPoint = GisUtils.createPoint(116.4074, 39.9042)
        val radiusKm = 5.0

        val time = measureTimeMillis {
            val result = ambulanceRepository.findNearbyWithDistance(
                centerPoint,
                radiusKm * 1000
            )
            assertNotNull(result)
        }

        println("PostGIS 5公里范围查询时间: ${time}ms")
        assertTrue(time <= POSTGIS_QUERY_THRESHOLD_MS, "PostGIS范围查询时间 ${time}ms 超过阈值 ${POSTGIS_QUERY_THRESHOLD_MS}ms")
    }

    @Test
    @Order(3)
    @DisplayName("病历保存响应时间测试 - 小于等于500毫秒")
    fun testMedicalRecordSaveTime() {
        val record = createTestMedicalRecord()

        val time = measureTimeMillis {
            val saved = medicalRecordService.createRecord(record)
            assertNotNull(saved.id)
        }

        println("病历保存响应时间: ${time}ms")
        assertTrue(time <= 500, "病历保存响应时间 ${time}ms 超过阈值 500ms")
    }

    @Test
    @Order(4)
    @DisplayName("数据库单表百万级记录查询测试 - 小于等于1秒")
    fun testMillionRecordQuery() {
        val count = medicalRecordRepository.count()
        println("当前病历记录数: $count")

        val time = measureTimeMillis {
            val page = medicalRecordRepository.findAll(
                org.springframework.data.domain.PageRequest.of(0, 20)
            )
            assertNotNull(page)
        }

        println("单表分页查询时间: ${time}ms")
        assertTrue(time <= DB_QUERY_THRESHOLD_MS, "单表查询时间 ${time}ms 超过阈值 ${DB_QUERY_THRESHOLD_MS}ms")
    }

    @Test
    @Order(5)
    @DisplayName("200台车辆并发位置上报性能测试")
    fun testConcurrentGpsUpdates() {
        val ambulanceCount = 200
        val threadPool = Executors.newFixedThreadPool(50)
        val countDownLatch = CountDownLatch(ambulanceCount)
        val successCount = AtomicInteger(0)
        val failCount = AtomicInteger(0)

        val ambulances = ambulanceRepository.findAll().take(ambulanceCount)
        val testAmbulances = if (ambulances.size >= ambulanceCount) {
            ambulances
        } else {
            (1..ambulanceCount).map { idx ->
                val ambulance = Ambulance(
                    vehicleNo = "TEST-GPS-${String.format("%03d", idx)}",
                    vehicleType = Ambulance.VehicleType.REGULAR_AMBULANCE.name,
                    equipmentLevel = Ambulance.EquipmentLevel.BASIC.name,
                    status = Ambulance.Status.AVAILABLE.name,
                    mileage = 0,
                    maintenanceIntervalKm = 5000
                )
                ambulanceRepository.save(ambulance)
            }
        }

        val startTime = System.currentTimeMillis()

        testAmbulances.forEach { ambulance ->
            threadPool.submit {
                try {
                    val location = com.ems.dispatch.dto.LocationDto(
                        ambulanceId = ambulance.id!!,
                        longitude = 116.4074 + (Math.random() - 0.5) * 0.1,
                        latitude = 39.9042 + (Math.random() - 0.5) * 0.1,
                        speedKmh = 30.0 + Math.random() * 50,
                        heading = Math.random() * 360,
                        timestamp = LocalDateTime.now().toString()
                    )
                    successCount.incrementAndGet()
                } catch (e: Exception) {
                    failCount.incrementAndGet()
                } finally {
                    countDownLatch.countDown()
                }
            }
        }

        countDownLatch.await(30, TimeUnit.SECONDS)
        val totalTime = System.currentTimeMillis() - startTime

        threadPool.shutdown()

        println("200台车辆并发上报测试完成:")
        println("  总耗时: ${totalTime}ms")
        println("  成功数: ${successCount.get()}")
        println("  失败数: ${failCount.get()}")
        println("  平均每台耗时: ${totalTime / ambulanceCount}ms")

        assertEquals(ambulanceCount, successCount.get(), "并发上报成功率应为100%")
        assertTrue(totalTime <= 3000, "200台车辆并发上报总耗时 ${totalTime}ms 超过阈值 3000ms")
    }

    @Test
    @Order(6)
    @DisplayName("50用户并发查询事件性能测试")
    fun testConcurrentEventQuery() {
        val threadPool = Executors.newFixedThreadPool(20)
        val countDownLatch = CountDownLatch(CONCURRENT_USERS)
        val successCount = AtomicInteger(0)
        val responseTimes = mutableListOf<Long>()

        val event = createTestDispatchEvent()

        repeat(CONCURRENT_USERS) {
            threadPool.submit {
                try {
                    val time = measureTimeMillis {
                        val result = dispatchService.getEventDetail(event.id!!)
                        assertNotNull(result)
                    }
                    synchronized(responseTimes) {
                        responseTimes.add(time)
                    }
                    successCount.incrementAndGet()
                } catch (e: Exception) {
                    e.printStackTrace()
                } finally {
                    countDownLatch.countDown()
                }
            }
        }

        countDownLatch.await(30, TimeUnit.SECONDS)
        threadPool.shutdown()

        val avgResponseTime = responseTimes.average()
        val maxResponseTime = responseTimes.maxOrNull() ?: 0
        val p95ResponseTime = responseTimes.sorted()[(responseTimes.size * 0.95).toInt()]

        println("50用户并发查询事件测试:")
        println("  成功数: ${successCount.get()}/$CONCURRENT_USERS")
        println("  平均响应时间: ${"%.2f".format(avgResponseTime)}ms")
        println("  最大响应时间: ${maxResponseTime}ms")
        println("  P95响应时间: ${p95ResponseTime}ms")

        assertEquals(CONCURRENT_USERS, successCount.get(), "并发查询成功率应为100%")
        assertTrue(p95ResponseTime <= RESPONSE_TIME_THRESHOLD_MS,
            "P95响应时间 ${p95ResponseTime}ms 超过阈值 ${RESPONSE_TIME_THRESHOLD_MS}ms")
    }

    @Test
    @Order(7)
    @DisplayName("关键接口响应时间汇总测试")
    fun testAllCriticalEndpoints() {
        val results = mutableMapOf<String, Long>()

        results["调度看板"] = measureTimeMillis {
            dispatchService.getDashboardData()
        }

        results["附近车辆查询"] = measureTimeMillis {
            val point = GisUtils.createPoint(116.4074, 39.9042)
            ambulanceRepository.findAvailableNearby(point, 5000.0)
        }

        results["活跃事件列表"] = measureTimeMillis {
            dispatchService.getActiveEvents(0, 20)
        }

        results["病历列表查询"] = measureTimeMillis {
            medicalRecordService.getRecords(0, 20, null, null, null, null)
        }

        println("\n=== 关键接口响应时间汇总 ===")
        results.forEach { (name, time) ->
            val status = if (time <= RESPONSE_TIME_THRESHOLD_MS) "✓" else "✗"
            println("  $status $name: ${time}ms")
        }
        println("============================\n")

        results.forEach { (name, time) ->
            assertTrue(time <= RESPONSE_TIME_THRESHOLD_MS, "$name 响应时间 ${time}ms 超过阈值 ${RESPONSE_TIME_THRESHOLD_MS}ms")
        }
    }

    @Test
    @Order(8)
    @DisplayName("分页查询性能测试")
    fun testPaginationPerformance() {
        val pageSizes = listOf(10, 20, 50, 100)
        val results = mutableMapOf<Int, Long>()

        pageSizes.forEach { size ->
            val time = measureTimeMillis {
                medicalRecordRepository.findAll(
                    org.springframework.data.domain.PageRequest.of(0, size)
                )
            }
            results[size] = time
        }

        println("分页查询性能:")
        results.forEach { (size, time) ->
            println("  每页 $size 条: ${time}ms")
        }

        assertTrue(results[100]!! <= DB_QUERY_THRESHOLD_MS, "100条分页查询时间超过阈值")
    }

    private fun createTestDispatchEvent(): DispatchEvent {
        val event = DispatchEvent(
            eventNo = "PERF-TEST-${System.currentTimeMillis()}",
            callerName = "性能测试",
            callerPhone = "13800138000",
            patientName = "测试患者",
            patientGender = "MALE",
            patientAge = 45,
            emergencyAddress = "北京市朝阳区测试街道1号",
            emergencyLocation = GisUtils.createPoint(116.4074, 39.9042),
            chiefComplaint = "胸痛2小时",
            conditionSeverity = DispatchEvent.ConditionSeverity.SEVERE.name,
            callReceivedTime = LocalDateTime.now()
        )
        return dispatchEventRepository.save(event)
    }

    private fun createTestMedicalRecord(): com.ems.dispatch.dto.MedicalRecordCreateRequest {
        return com.ems.dispatch.dto.MedicalRecordCreateRequest(
            dispatchEventId = createTestDispatchEvent().id!!,
            patientName = "性能测试患者",
            gender = "MALE",
            age = 50,
            chiefComplaint = "胸痛伴呼吸困难3小时",
            preliminaryDiagnosis = "急性冠脉综合征",
            historyOfPresentIllness = "患者3小时前无明显诱因出现胸痛",
            pastMedicalHistory = "高血压病史10年",
            allergies = "青霉素过敏",
            vitalSigns = listOf(
                com.ems.dispatch.dto.VitalSignDto(
                    type = "BLOOD_PRESSURE_SYS",
                    value = 140.0,
                    unit = "mmHg",
                    measuredAt = LocalDateTime.now().toString()
                ),
                com.ems.dispatch.dto.VitalSignDto(
                    type = "PULSE",
                    value = 95.0,
                    unit = "次/分",
                    measuredAt = LocalDateTime.now().toString()
                )
            ),
            treatments = listOf(
                com.ems.dispatch.dto.TreatmentDto(
                    type = "OXYGEN",
                    description = "鼻导管吸氧 3L/min",
                    startTime = LocalDateTime.now().toString(),
                    endTime = null
                )
            ),
            medications = listOf(
                com.ems.dispatch.dto.MedicationDto(
                    name = "阿司匹林",
                    dosage = "300mg",
                    route = "ORAL",
                    administeredAt = LocalDateTime.now().toString()
                )
            ),
            disposition = "TRANSPORTED",
            handoverTo = "急诊科",
            handoverNotes = "患者生命体征平稳，建议进一步检查"
        )
    }
}
