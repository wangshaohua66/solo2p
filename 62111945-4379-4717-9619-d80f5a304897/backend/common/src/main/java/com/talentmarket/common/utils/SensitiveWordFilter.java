package com.talentmarket.common.utils;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@Component
public class SensitiveWordFilter {

    private static final Set<String> SENSITIVE_WORDS = new HashSet<>();
    private static final String REPLACEMENT = "***";
    
    private Map<Character, Map> sensitiveWordMap;

    @PostConstruct
    public void init() {
        loadDefaultSensitiveWords();
        buildSensitiveWordMap();
        log.info("敏感词过滤器初始化完成，共加载 {} 个敏感词", SENSITIVE_WORDS.size());
    }

    private void loadDefaultSensitiveWords() {
        SENSITIVE_WORDS.add("暴力");
        SENSITIVE_WORDS.add("色情");
        SENSITIVE_WORDS.add("赌博");
        SENSITIVE_WORDS.add("毒品");
        SENSITIVE_WORDS.add("诈骗");
        SENSITIVE_WORDS.add("传销");
        SENSITIVE_WORDS.add("反动");
        SENSITIVE_WORDS.add("恐怖");
        SENSITIVE_WORDS.add("邪教");
        SENSITIVE_WORDS.add("违法");
        SENSITIVE_WORDS.add("枪支");
        SENSITIVE_WORDS.add("弹药");
        SENSITIVE_WORDS.add("走私");
        SENSITIVE_WORDS.add("洗钱");
        SENSITIVE_WORDS.add("造假");
        SENSITIVE_WORDS.add("代考");
        SENSITIVE_WORDS.add("代写");
        SENSITIVE_WORDS.add("假证");
        SENSITIVE_WORDS.add("兼职刷");
        SENSITIVE_WORDS.add("刷单");
        SENSITIVE_WORDS.add("贷款");
        SENSITIVE_WORDS.add("裸贷");
        SENSITIVE_WORDS.add("高利贷");
        SENSITIVE_WORDS.add("套路贷");
        SENSITIVE_WORDS.add("政治敏感");
    }

    @SuppressWarnings("unchecked")
    private void buildSensitiveWordMap() {
        sensitiveWordMap = new HashMap<>(SENSITIVE_WORDS.size());
        Map currentMap;
        Map<String, String> newWordMap;

        for (String word : SENSITIVE_WORDS) {
            currentMap = sensitiveWordMap;
            for (int i = 0; i < word.length(); i++) {
                char charWord = word.charAt(i);
                Object wordMap = currentMap.get(charWord);

                if (wordMap != null) {
                    currentMap = (Map) wordMap;
                } else {
                    newWordMap = new HashMap<>();
                    newWordMap.put("isEnd", "0");
                    currentMap.put(charWord, newWordMap);
                    currentMap = newWordMap;
                }

                if (i == word.length() - 1) {
                    currentMap.put("isEnd", "1");
                }
            }
        }
    }

    public boolean containsSensitiveWord(String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }

        for (int i = 0; i < text.length(); i++) {
            if (checkSensitiveWord(text, i) > 0) {
                return true;
            }
        }
        return false;
    }

    public String filterSensitiveWord(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }

        StringBuilder result = new StringBuilder();
        int position = 0;

        while (position < text.length()) {
            int length = checkSensitiveWord(text, position);
            if (length > 0) {
                result.append(REPLACEMENT);
                position += length;
            } else {
                result.append(text.charAt(position));
                position++;
            }
        }

        return result.toString();
    }

    @SuppressWarnings("unchecked")
    private int checkSensitiveWord(String text, int beginIndex) {
        boolean flag = false;
        int matchFlag = 0;
        char word;
        Map currentMap = sensitiveWordMap;

        for (int i = beginIndex; i < text.length(); i++) {
            word = text.charAt(i);
            currentMap = (Map) currentMap.get(word);

            if (currentMap == null) {
                break;
            } else {
                matchFlag++;
                if ("1".equals(currentMap.get("isEnd"))) {
                    flag = true;
                    break;
                }
            }
        }

        if (!flag) {
            matchFlag = 0;
        }

        return matchFlag;
    }

    public List<String> findSensitiveWords(String text) {
        List<String> foundWords = new ArrayList<>();
        if (text == null || text.isEmpty()) {
            return foundWords;
        }

        int position = 0;
        while (position < text.length()) {
            int length = checkSensitiveWord(text, position);
            if (length > 0) {
                foundWords.add(text.substring(position, position + length));
                position += length;
            } else {
                position++;
            }
        }

        return foundWords;
    }

    public void addSensitiveWord(String word) {
        SENSITIVE_WORDS.add(word);
        buildSensitiveWordMap();
    }

    public void addSensitiveWords(Collection<String> words) {
        SENSITIVE_WORDS.addAll(words);
        buildSensitiveWordMap();
    }
}
