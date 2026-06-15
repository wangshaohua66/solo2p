package com.ems.dispatch.controller

import com.ems.dispatch.dto.ApiResponse
import com.ems.dispatch.dto.PageResponse
import com.ems.dispatch.service.QualityControlService
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
@RequestMapping("/quality-control")
@Tag(name = "质控管理", description = "病历抽查、质量考核、指标统计相关API")
class QualityControlController(
    private val qualityControlService: QualityControlService,
    private val userRepository: com.ems.dispatch.repository.UserRepository
) {
    @PostMapping("/reviews")
    @Operation(
        summary = "创建质控抽查",
        description = "质控员创建病历抽查任务，支持随机抽样和指定抽查"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "创建成功"),
        ApiResponse(responseCode = "404", description = "病历不存在")
    )
    fun createReview(
        @Valid @RequestBody request: QualityControlService.ReviewCreateRequest,
        @AuthenticationPrincipal userDetails: UserDetails
    ): ResponseEntity<ApiResponse<QualityControlService.ReviewSummary>> {
        val reviewer = userRepository.findByUsername(userDetails.username)
        val review = qualityControlService.createReview(request, reviewer)
        val summary = QualityControlService.ReviewSummary(
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
        return ResponseEntity.ok(ApiResponse.success(summary, "质控抽查创建成功"))
    }

    @PutMapping("/reviews/{id}")
    @Operation(
        summary = "提交质控结果",
        description = "质控员提交评分、缺陷标注、改进建议等质控结果"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "提交成功"),
        ApiResponse(responseCode = "404", description = "质控记录不存在")
    )
    fun updateReview(
        @Parameter(description = "质控记录ID") @PathVariable id: Long,
        @Valid @RequestBody request: QualityControlService.ReviewUpdateRequest,
        @AuthenticationPrincipal userDetails: UserDetails
    ): ResponseEntity<ApiResponse<QualityControlService.ReviewDetail>> {
        val reviewer = userRepository.findByUsername(userDetails.username)!!
        qualityControlService.updateReview(id, request, reviewer)
        val result = qualityControlService.getReview(id)
        return ResponseEntity.ok(ApiResponse.success(result, "质控结果提交成功"))
    }

    @PostMapping("/reviews/{id}/rectification")
    @Operation(
        summary = "完成整改",
        description = "标记缺陷整改完成"
    )
    fun completeRectification(
        @Parameter(description = "质控记录ID") @PathVariable id: Long,
        @RequestBody(required = false) notes: String?
    ): ResponseEntity<ApiResponse<QualityControlService.ReviewDetail>> {
        qualityControlService.completeRectification(id, notes)
        val result = qualityControlService.getReview(id)
        return ResponseEntity.ok(ApiResponse.success(result, "整改完成"))
    }

    @GetMapping("/reviews/{id}")
    @Operation(
        summary = "获取质控详情",
        description = "获取质控记录的详细信息"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "查询成功"),
        ApiResponse(responseCode = "404", description = "质控记录不存在")
    )
    fun getReview(
        @Parameter(description = "质控记录ID") @PathVariable id: Long
    ): ResponseEntity<ApiResponse<QualityControlService.ReviewDetail>> {
        val result = qualityControlService.getReview(id)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/reviews/pending")
    @Operation(
        summary = "获取待质控列表",
        description = "获取所有待评审的质控记录"
    )
    fun getPendingReviews(
        @Parameter(description = "页码") @RequestParam(defaultValue = "0") page: Int,
        @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<ApiResponse<PageResponse<QualityControlService.ReviewSummary>>> {
        val result = qualityControlService.getPendingReviews(page, size)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/reviews")
    @Operation(
        summary = "按时间范围查询质控记录",
        description = "支持按时间段分页查询历史质控记录"
    )
    fun getReviewsByDateRange(
        @Parameter(description = "开始时间") @RequestParam startDate: LocalDateTime,
        @Parameter(description = "结束时间") @RequestParam endDate: LocalDateTime,
        @Parameter(description = "页码") @RequestParam(defaultValue = "0") page: Int,
        @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<ApiResponse<PageResponse<QualityControlService.ReviewSummary>>> {
        val result = qualityControlService.getReviewsByDateRange(startDate, endDate, page, size)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/dashboard")
    @Operation(
        summary = "质控仪表盘",
        description = "获取质控核心指标统计，包括完成率、平均分、状态分布等"
    )
    fun getDashboardStats(
        @Parameter(description = "开始时间") @RequestParam startDate: LocalDateTime,
        @Parameter(description = "结束时间") @RequestParam endDate: LocalDateTime
    ): ResponseEntity<ApiResponse<QualityControlService.QcDashboardStats>> {
        val result = qualityControlService.getDashboardStats(startDate, endDate)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/performance-metrics")
    @Operation(
        summary = "绩效指标统计",
        description = "获取急救响应时间、现场处置时长、转运时长等核心考核指标，支持多维钻取"
    )
    fun getPerformanceMetrics(
        @Parameter(description = "开始时间") @RequestParam startDate: LocalDateTime,
        @Parameter(description = "结束时间") @RequestParam endDate: LocalDateTime
    ): ResponseEntity<ApiResponse<Map<String, Any>>> {
        val result = qualityControlService.getPerformanceMetrics(startDate, endDate)
        return ResponseEntity.ok(ApiResponse.success(result))
    }
}
