package com.ems.dispatch.controller

import com.ems.dispatch.dto.*
import com.ems.dispatch.entity.User
import com.ems.dispatch.service.MedicalRecordService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import java.time.LocalDateTime

@RestController
@RequestMapping("/medical-records")
@Tag(name = "急救病历", description = "结构化急救病历录入、查询、锁定相关API")
class MedicalRecordController(
    private val medicalRecordService: MedicalRecordService,
    private val userRepository: com.ems.dispatch.repository.UserRepository
) {
    @PostMapping
    @Operation(
        summary = "创建急救病历",
        description = "急救医师录入患者信息、生命体征、处置措施等病历内容"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "创建成功"),
        ApiResponse(responseCode = "400", description = "该事件病历已存在或参数错误"),
        ApiResponse(responseCode = "404", description = "急救事件不存在")
    )
    fun createRecord(
        @Valid @RequestBody request: MedicalRecordCreateRequest,
        @AuthenticationPrincipal userDetails: UserDetails
    ): ResponseEntity<ApiResponse<MedicalRecordDetail>> {
        val doctor = userRepository.findByUsername(userDetails.username)!!
        val result = medicalRecordService.createRecord(request, doctor)
        return ResponseEntity.ok(ApiResponse.success(result, "病历创建成功"))
    }

    @PutMapping("/{id}")
    @Operation(
        summary = "更新急救病历",
        description = "更新未锁定的病历内容，病历保存响应≤500毫秒"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "更新成功"),
        ApiResponse(responseCode = "400", description = "病历已锁定，无法修改"),
        ApiResponse(responseCode = "404", description = "病历不存在")
    )
    fun updateRecord(
        @Parameter(description = "病历ID") @PathVariable id: Long,
        @Valid @RequestBody request: MedicalRecordUpdateRequest,
        @AuthenticationPrincipal userDetails: UserDetails
    ): ResponseEntity<ApiResponse<MedicalRecordDetail>> {
        val doctor = userRepository.findByUsername(userDetails.username)!!
        val result = medicalRecordService.updateRecord(id, request, doctor)
        return ResponseEntity.ok(ApiResponse.success(result, "病历更新成功"))
    }

    @PostMapping("/{id}/lock")
    @Operation(
        summary = "锁定病历",
        description = "提交并锁定病历，锁定后不可篡改，同时触发质控自动检查"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "锁定成功"),
        ApiResponse(responseCode = "400", description = "病历已锁定"),
        ApiResponse(responseCode = "404", description = "病历不存在")
    )
    fun lockRecord(
        @Parameter(description = "病历ID") @PathVariable id: Long,
        @AuthenticationPrincipal userDetails: UserDetails
    ): ResponseEntity<ApiResponse<MedicalRecordDetail>> {
        val doctor = userRepository.findByUsername(userDetails.username)!!
        val result = medicalRecordService.lockRecord(id, doctor)
        return ResponseEntity.ok(ApiResponse.success(result, "病历已锁定"))
    }

    @GetMapping("/{id}")
    @Operation(
        summary = "获取病历详情",
        description = "获取完整的病历内容"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "查询成功"),
        ApiResponse(responseCode = "404", description = "病历不存在")
    )
    fun getRecord(
        @Parameter(description = "病历ID") @PathVariable id: Long
    ): ResponseEntity<ApiResponse<MedicalRecordDetail>> {
        val result = medicalRecordService.getRecord(id)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping
    @Operation(
        summary = "按时间范围查询病历",
        description = "分页查询历史病历"
    )
    fun getRecordsByDateRange(
        @Parameter(description = "开始时间") @RequestParam startDate: LocalDateTime,
        @Parameter(description = "结束时间") @RequestParam endDate: LocalDateTime,
        @Parameter(description = "页码") @RequestParam(defaultValue = "0") page: Int,
        @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<ApiResponse<PageResponse<MedicalRecordSummary>>> {
        val result = medicalRecordService.getRecordsByDateRange(startDate, endDate, page, size)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/pending-review")
    @Operation(
        summary = "获取待质控病历",
        description = "获取尚未进行质控抽查的病历列表"
    )
    fun getRecordsPendingReview(
        @Parameter(description = "页码") @RequestParam(defaultValue = "0") page: Int,
        @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<ApiResponse<PageResponse<MedicalRecordSummary>>> {
        val result = medicalRecordService.getRecordsPendingReview(page, size)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/statistics")
    @Operation(
        summary = "病历统计",
        description = "获取指定时间段内的病历统计数据，包括疾病分布等"
    )
    fun getStatistics(
        @Parameter(description = "开始时间") @RequestParam startDate: LocalDateTime,
        @Parameter(description = "结束时间") @RequestParam endDate: LocalDateTime
    ): ResponseEntity<ApiResponse<Map<String, Any>>> {
        val result = medicalRecordService.getStatistics(startDate, endDate)
        return ResponseEntity.ok(ApiResponse.success(result))
    }
}
