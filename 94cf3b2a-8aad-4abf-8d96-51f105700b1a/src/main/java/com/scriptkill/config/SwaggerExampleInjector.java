package com.scriptkill.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.media.NumberSchema;
import io.swagger.v3.oas.models.media.IntegerSchema;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Configuration
public class SwaggerExampleInjector implements OpenApiCustomizer {

    private static final Logger log = LoggerFactory.getLogger(SwaggerExampleInjector.class);
    private static final Pattern INSERT_PATTERN = Pattern.compile(
            "INSERT INTO scripts\\s*\\([^)]+\\)\\s*VALUES\\s*\\(([^;]+)\\);?",
            Pattern.CASE_INSENSITIVE);

    @Override
    public void customise(OpenAPI openApi) {
        Map<String, String> scriptIds = loadScriptExamplesFromSeed();
        if (scriptIds.isEmpty()) {
            return;
        }
        if (openApi.getComponents() == null || openApi.getComponents().getSchemas() == null) {
            return;
        }
        for (Map.Entry<String, Schema> entry : openApi.getComponents().getSchemas().entrySet()) {
            Schema schema = entry.getValue();
            if (schema.getProperties() == null) {
                continue;
            }
            injectScriptExamples(schema.getProperties(), scriptIds);
        }
    }

    private void injectScriptExamples(Map<String, Schema> props, Map<String, String> ids) {
        Object scriptIdExample = ids.keySet().stream().findFirst().map(Long::valueOf).orElse(1L);
        Object scriptNameExample = ids.values().stream().findFirst().orElse("雾都孤儿");
        for (Map.Entry<String, Schema> prop : props.entrySet()) {
            String name = prop.getKey().toLowerCase();
            Schema sch = prop.getValue();
            try {
                if (name.contains("scriptid") || name.equals("script_id")) {
                    if (sch instanceof IntegerSchema || sch instanceof NumberSchema) {
                        sch.setExample(scriptIdExample);
                    } else if (sch instanceof StringSchema) {
                        sch.setExample(String.valueOf(scriptIdExample));
                    }
                } else if (name.contains("scriptname") || name.equals("script_name")) {
                    sch.setExample(scriptNameExample);
                }
            } catch (Exception e) {
                log.debug("Inject example skip: {} - {}", name, e.getMessage());
            }
        }
    }

    private Map<String, String> loadScriptExamplesFromSeed() {
        Map<String, String> result = new HashMap<>();
        try {
            ClassPathResource res = new ClassPathResource("db/migration/V2__seed_data.sql");
            if (!res.exists()) {
                return result;
            }
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(res.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line).append("\n");
                }
            }
            Matcher m = INSERT_PATTERN.matcher(sb.toString());
            if (m.find()) {
                String valueStr = m.group(1);
                String[] rows = valueStr.split("\\),\\s*\\(");
                long idSeq = 1L;
                for (String row : rows) {
                    String clean = row.trim();
                    if (clean.startsWith("(")) clean = clean.substring(1);
                    if (clean.endsWith(")")) clean = clean.substring(0, clean.length() - 1);
                    String[] fields = splitSqlValues(clean);
                    if (fields.length > 0) {
                        result.put(String.valueOf(idSeq), fields[0].replaceAll("'", "").trim());
                        idSeq++;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Load seed script examples failed: {}", e.getMessage());
        }
        log.info("Loaded {} script examples for swagger", result.size());
        return result;
    }

    private String[] splitSqlValues(String line) {
        java.util.List<String> tokens = new java.util.ArrayList<>();
        boolean inQuote = false;
        StringBuilder cur = new StringBuilder();
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '\'' && (i == 0 || line.charAt(i - 1) != '\\')) {
                inQuote = !inQuote;
            } else if (c == ',' && !inQuote) {
                tokens.add(cur.toString());
                cur.setLength(0);
                continue;
            }
            cur.append(c);
        }
        if (cur.length() > 0) tokens.add(cur.toString());
        return tokens.toArray(new String[0]);
    }
}
