package com.ems.dispatch.controller

import com.ems.dispatch.service.SpeechRecognitionService
import com.ems.dispatch.dto.ApiResponse
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/speech")
@Tag(name = "语音识别", description = "语音转文字、医学术语识别相关API")
class SpeechRecognitionController(
    private val speechRecognitionService: SpeechRecognitionService
) {

    @PostMapping("/recognize", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    @Operation(
        summary = "语音识别（文件上传）",
        description = "上传音频文件进行语音转文字，支持医学领域术语优化"
    )
    fun recognizeSpeechFile(
        @Parameter(description = "音频文件") @RequestParam("file") file: MultipartFile,
        @Parameter(description = "语言代码，默认zh-CN") @RequestParam(required = false, defaultValue = "zh-CN") language: String,
        @Parameter(description = "字段上下文，用于医学术语优化") @RequestParam(required = false) fieldContext: String?
    ): ResponseEntity<ApiResponse<SpeechRecognitionService.SpeechRecognitionResult>> {
        val result = speechRecognitionService.recognizeAudioFile(file, language, fieldContext)
        return ResponseEntity.ok(ApiResponse.success(result, "识别成功"))
    }

    @GetMapping("/languages")
    @Operation(
        summary = "获取支持的语言列表",
        description = "获取所有支持的语音识别语言"
    )
    fun getSupportedLanguages(): ResponseEntity<ApiResponse<List<Map<String, String>>>> {
        val languages = speechRecognitionService.getSupportedLanguages()
        return ResponseEntity.ok(ApiResponse.success(languages, "查询成功"))
    }

    @GetMapping("/medical-keywords")
    @Operation(
        summary = "获取医学关键词列表",
        description = "获取指定字段的医学关键词，用于语音识别优化"
    )
    fun getMedicalKeywords(
        @Parameter(description = "字段名称") @RequestParam field: String
    ): ResponseEntity<ApiResponse<List<String>>> {
        val keywords = speechRecognitionService.getMedicalKeywords(field)
        return ResponseEntity.ok(ApiResponse.success(keywords, "查询成功"))
    }

    @PostMapping("/stream/start")
    @Operation(
        summary = "开始流式语音识别",
        description = "开始实时流式语音识别会话"
    )
    fun startStream(
        @Parameter(description = "会话ID") @RequestParam sessionId: String,
        @Parameter(description = "语言代码") @RequestParam(required = false, defaultValue = "zh-CN") language: String
    ): ResponseEntity<ApiResponse<Map<String, Any>>> {
        val result = speechRecognitionService.streamStart(sessionId, language)
        return ResponseEntity.ok(ApiResponse.success(result, "会话已启动"))
    }

    @PostMapping("/stream/chunk", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    @Operation(
        summary = "发送语音片段",
        description = "发送实时语音片段到流式识别会话"
    )
    fun sendChunk(
        @Parameter(description = "会话ID") @RequestParam sessionId: String,
        @Parameter(description = "音频片段") @RequestParam("chunk") chunk: MultipartFile
    ): ResponseEntity<ApiResponse<Map<String, Any>>> {
        val result = speechRecognitionService.streamChunk(sessionId, chunk.bytes)
        return ResponseEntity.ok(ApiResponse.success(result, "片段已接收"))
    }

    @PostMapping("/stream/end")
    @Operation(
        summary = "结束流式语音识别",
        description = "结束流式识别会话并返回最终结果"
    )
    fun endStream(
        @Parameter(description = "会话ID") @RequestParam sessionId: String
    ): ResponseEntity<ApiResponse<SpeechRecognitionService.SpeechRecognitionResult>> {
        val result = speechRecognitionService.streamEnd(sessionId)
        return ResponseEntity.ok(ApiResponse.success(result, "识别完成"))
    }

    @PostMapping("/post-process")
    @Operation(
        summary = "医学文本后处理",
        description = "对语音识别结果进行医学术语修正和格式优化"
    )
    fun postProcessText(
        @Parameter(description = "原始文本") @RequestParam text: String,
        @Parameter(description = "字段上下文") @RequestParam(required = false) field: String?
    ): ResponseEntity<ApiResponse<Map<String, String>>> {
        val processed = speechRecognitionService.applyMedicalPostProcessing(text, field ?: "general")
        return ResponseEntity.ok(
            ApiResponse.success(
                mapOf("original" to text, "processed" to processed),
                "处理成功"
            )
        )
    }
}
