package com.ems.dispatch.service

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.util.*

@Service
class SpeechRecognitionService(
    @Value("\${ems.speech.provider:local}")
    private val speechProvider: String,
    @Value("\${ems.speech.language:zh-CN}")
    private val defaultLanguage: String,
    @Value("\${ems.speech.max-duration-seconds:60}")
    private val maxDurationSeconds: Int
) {
    private val logger = LoggerFactory.getLogger(SpeechRecognitionService::class.java)

    data class SpeechRecognitionRequest(
        val audioData: ByteArray,
        val language: String = "zh-CN",
        val format: String = "webm",
        val sampleRate: Int = 16000,
        val context: String? = null,
        val enablePunctuation: Boolean = true
    )

    data class SpeechRecognitionResult(
        val text: String,
        val confidence: Float,
        val language: String,
        val durationMs: Long,
        val alternatives: List<Alternative> = emptyList(),
        val segments: List<Segment> = emptyList()
    ) {
        data class Alternative(
            val text: String,
            val confidence: Float
        )

        data class Segment(
            val text: String,
            val startTimeMs: Long,
            val endTimeMs: Long,
            val confidence: Float
        )
    }

    data class MedicalDomainDict(
        val field: String,
        val keywords: List<String>
    )

    private val medicalDomainDictionaries = mapOf(
        "chiefComplaint" to MedicalDomainDict(
            field = "chiefComplaint",
            keywords = listOf(
                "胸痛", "呼吸困难", "头痛", "腹痛", "发热", "呕吐", "腹泻",
                "意识不清", "昏迷", "抽搐", "心悸", "胸闷", "咯血", "呕血",
                "外伤", "骨折", "烧伤", "中毒", "过敏", "眩晕", "血压高",
                "血糖低", "心肌梗死", "脑梗塞", "脑出血", "哮喘", "心绞痛"
            )
        ),
        "historyOfPresentIllness" to MedicalDomainDict(
            field = "historyOfPresentIllness",
            keywords = listOf(
                "既往", "高血压", "糖尿病", "冠心病", "脑梗塞", "脑出血",
                "慢性支气管炎", "肺气肿", "胃炎", "胃溃疡", "肝炎",
                "肾炎", "甲状腺疾病", "手术史", "过敏史", "家族史"
            )
        ),
        "preliminaryDiagnosis" to MedicalDomainDict(
            field = "preliminaryDiagnosis",
            keywords = listOf(
                "急性心肌梗死", "不稳定型心绞痛", "急性脑梗塞", "脑出血",
                "急性左心衰", "呼吸衰竭", "休克", "过敏性休克",
                "急性胃肠炎", "急性阑尾炎", "急性胆囊炎", "急性胰腺炎",
                "骨折", "软组织损伤", "烧伤", "电击伤", "中毒",
                "糖尿病酮症酸中毒", "低血糖昏迷", "高血压急症"
            )
        )
    )

    fun recognizeSpeech(request: SpeechRecognitionRequest): SpeechRecognitionResult {
        logger.info("Processing speech recognition, format=${request.format}, language=${request.language}")

        return when (speechProvider) {
            "mock" -> mockRecognition(request)
            else -> localRecognition(request)
        }
    }

    fun recognizeAudioFile(
        file: MultipartFile,
        language: String = defaultLanguage,
        fieldContext: String? = null
    ): SpeechRecognitionResult {
        if (file.size > maxDurationSeconds * 1024 * 1024L) {
            throw IllegalArgumentException("Audio file too large, max ${maxDurationSeconds}MB")
        }

        val request = SpeechRecognitionRequest(
            audioData = file.bytes,
            language = language,
            format = file.originalFilename?.substringAfterLast('.') ?: "webm",
            context = fieldContext
        )

        return recognizeSpeech(request)
    }

    private fun localRecognition(request: SpeechRecognitionRequest): SpeechRecognitionResult {
        logger.warn("Using local mock recognition as no real ASR service configured")
        return mockRecognition(request)
    }

    private fun mockRecognition(request: SpeechRecognitionRequest): SpeechRecognitionResult {
        val mockTexts = mapOf(
            "chiefComplaint" to listOf(
                "患者主诉胸痛2小时，伴胸闷气短",
                "患者呼吸困难半天，加重2小时",
                "患者突发意识不清1小时",
                "患者腹痛半天，伴恶心呕吐",
                "患者发热39度，伴咳嗽咳痰"
            ),
            "historyOfPresentIllness" to listOf(
                "患者既往有高血压病史10年，平时口服硝苯地平缓释片，血压控制欠佳",
                "患者既往有糖尿病史5年，口服二甲双胍治疗，血糖控制一般",
                "患者既往体健，无高血压糖尿病等慢性病史",
                "患者有冠心病史3年，曾行冠脉支架植入术"
            ),
            "preliminaryDiagnosis" to listOf(
                "初步诊断：急性冠脉综合征 不稳定型心绞痛",
                "初步诊断：急性脑梗塞 高血压3级 很高危",
                "初步诊断：2型糖尿病 糖尿病酮症酸中毒待排",
                "初步诊断：急性胃肠炎 电解质紊乱"
            )
        )

        val context = request.context ?: "general"
        val candidates = mockTexts[context] ?: mockTexts["chiefComplaint"]!!
        val text = candidates[Random().nextInt(candidates.size)]

        val confidence = 0.85f + Random().nextFloat() * 0.1f
        val durationMs = 3000L + Random().nextInt(10000)

        return SpeechRecognitionResult(
            text = text,
            confidence = confidence,
            language = request.language,
            durationMs = durationMs,
            alternatives = listOf(
                SpeechRecognitionResult.Alternative(text, confidence),
                SpeechRecognitionResult.Alternative(text + "？", confidence - 0.05f)
            ),
            segments = listOf(
                SpeechRecognitionResult.Segment(text, 0, durationMs, confidence)
            )
        )
    }

    fun getSupportedLanguages(): List<Map<String, String>> {
        return listOf(
            mapOf("code" to "zh-CN", "name" to "普通话（简体中文）"),
            mapOf("code" to "zh-TW", "name" to "普通话（繁体中文）"),
            mapOf("code" to "zh-HK", "name" to "粤语"),
            mapOf("code" to "en-US", "name" to "英语（美式）"),
            mapOf("code" to "en-GB", "name" to "英语（英式）"),
            mapOf("code" to "ja-JP", "name" to "日语")
        )
    }

    fun getMedicalKeywords(field: String): List<String> {
        return medicalDomainDictionaries[field]?.keywords ?: emptyList()
    }

    fun applyMedicalPostProcessing(
        text: String,
        field: String
    ): String {
        var processed = text.trim()

        if (field == "chiefComplaint" && !processed.endsWith("。")) {
            processed += "。"
        }

        val dict = medicalDomainDictionaries[field]
        dict?.keywords?.forEach { keyword ->
            processed = processed.replace(keyword, keyword)
        }

        return processed
    }

    fun streamStart(sessionId: String, language: String = defaultLanguage): Map<String, Any> {
        logger.info("Starting speech recognition stream: $sessionId")
        return mapOf(
            "sessionId" to sessionId,
            "status" to "STARTED",
            "language" to language
        )
    }

    fun streamChunk(sessionId: String, audioChunk: ByteArray): Map<String, Any> {
        logger.debug("Received speech chunk for session: $sessionId, size: ${audioChunk.size}")
        return mapOf(
            "sessionId" to sessionId,
            "partial" to false,
            "text" to ""
        )
    }

    fun streamEnd(sessionId: String): SpeechRecognitionResult {
        logger.info("Ending speech recognition stream: $sessionId")
        return SpeechRecognitionResult(
            text = "",
            confidence = 0.0f,
            language = defaultLanguage,
            durationMs = 0
        )
    }
}
