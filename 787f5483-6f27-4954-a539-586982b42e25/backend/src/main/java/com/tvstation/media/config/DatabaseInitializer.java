package com.tvstation.media.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseInitializer implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        initMaterialFullTextSearch();
    }

    private void initMaterialFullTextSearch() {
        try {
            jdbcTemplate.execute(
                "ALTER TABLE materials ADD COLUMN IF NOT EXISTS search_vector tsvector");

            jdbcTemplate.execute(
                "UPDATE materials SET search_vector = " +
                "to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')) " +
                "WHERE search_vector IS NULL");

            jdbcTemplate.execute(
                "CREATE OR REPLACE FUNCTION materials_search_vector_update() RETURNS trigger AS $$ " +
                "BEGIN " +
                "  NEW.search_vector := to_tsvector('simple', coalesce(NEW.name, '') || ' ' || coalesce(NEW.description, '')); " +
                "  RETURN NEW; " +
                "END; $$ LANGUAGE plpgsql");

            jdbcTemplate.execute(
                "DROP TRIGGER IF EXISTS materials_search_vector_trigger ON materials");
            jdbcTemplate.execute(
                "CREATE TRIGGER materials_search_vector_trigger " +
                "BEFORE INSERT OR UPDATE ON materials " +
                "FOR EACH ROW EXECUTE FUNCTION materials_search_vector_update()");

            jdbcTemplate.execute(
                "DROP INDEX IF EXISTS idx_material_search_vector");
            jdbcTemplate.execute(
                "CREATE INDEX idx_material_search_vector ON materials USING GIN(search_vector)");

            log.info("Material full-text search index initialized successfully");
        } catch (Exception e) {
            log.warn("Failed to initialize material full-text search index: {}", e.getMessage());
        }
    }
}
