package com.glassstudio.converter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.glassstudio.entity.CurveSegment;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Converter
public class SegmentConverter implements AttributeConverter<List<CurveSegment>, String> {

    private static final ObjectMapper objectMapper;

    static {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Override
    public String convertToDatabaseColumn(List<CurveSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(segments);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize segments to JSON", e);
            return "[]";
        }
    }

    @Override
    public List<CurveSegment> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(dbData, new TypeReference<List<CurveSegment>>() {});
        } catch (JsonProcessingException e) {
            log.error("Failed to deserialize segments from JSON", e);
            return new ArrayList<>();
        }
    }
}
