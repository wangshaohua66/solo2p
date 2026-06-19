package com.talentmarket.enterprise.service;

import com.talentmarket.common.exception.BusinessException;
import com.talentmarket.common.result.ResultCode;
import com.talentmarket.common.utils.SensitiveWordFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SensitiveWordService {

    private final SensitiveWordFilter sensitiveWordFilter;

    public SensitiveCheckResult checkText(String text) {
        if (text == null || text.isEmpty()) {
            return new SensitiveCheckResult(true, List.of(), text);
        }

        boolean containsSensitive = sensitiveWordFilter.containsSensitiveWord(text);
        List<String> foundWords = sensitiveWordFilter.findSensitiveWords(text);
        String filteredText = sensitiveWordFilter.filterSensitiveWord(text);

        return new SensitiveCheckResult(!containsSensitive, foundWords, filteredText);
    }

    public void checkAndThrow(String text, String fieldName) {
        SensitiveCheckResult result = checkText(text);
        if (!result.isPassed()) {
            log.warn("内容包含敏感词，字段: {}, 敏感词: {}", fieldName, result.getSensitiveWords());
            throw new BusinessException(ResultCode.SENSITIVE_WORD_FOUND.getCode(),
                    fieldName + "包含敏感词：" + result.getSensitiveWords());
        }
    }

    public String filterText(String text) {
        return sensitiveWordFilter.filterSensitiveWord(text);
    }

    public void addSensitiveWords(List<String> words) {
        sensitiveWordFilter.addSensitiveWords(words);
        log.info("添加敏感词: {}", words);
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class SensitiveCheckResult {
        private boolean passed;
        private List<String> sensitiveWords;
        private String filteredText;
    }
}
