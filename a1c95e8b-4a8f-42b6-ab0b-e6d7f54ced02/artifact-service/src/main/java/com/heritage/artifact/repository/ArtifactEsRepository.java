package com.heritage.artifact.repository;

import com.heritage.artifact.entity.ArtifactEsIndex;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.annotations.Highlight;
import org.springframework.data.elasticsearch.annotations.HighlightField;
import org.springframework.data.elasticsearch.annotations.HighlightParameters;
import org.springframework.data.elasticsearch.annotations.Query;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ArtifactEsRepository extends ElasticsearchRepository<ArtifactEsIndex, String> {

    Page<ArtifactEsIndex> findByNameContainingOrDescriptionContaining(String name, String description, Pageable pageable);

    List<ArtifactEsIndex> findByType(String type);

    List<ArtifactEsIndex> findByLevel(String level);

    List<ArtifactEsIndex> findByDynasty(String dynasty);

    @Query("{\"bool\":{\"must\":[{\"multi_match\":{\"query\":\"?0\",\"fields\":[\"name^5\",\"artifactCode^3\",\"description^2\",\"material\",\"dynasty^2\",\"technique\",\"historicalNote\",\"allText\"],\"type\":\"best_fields\",\"operator\":\"and\",\"minimum_should_match\":\"80%\"}}],\"filter\":?1}}")
    @Highlight(
        fields = {
            @HighlightField(name = "name"),
            @HighlightField(name = "description"),
            @HighlightField(name = "material"),
            @HighlightField(name = "dynasty"),
            @HighlightField(name = "technique"),
            @HighlightField(name = "historicalNote")
        },
        parameters = @HighlightParameters(
            preTags = {"<mark>"},
            postTags = {"</mark>"},
            fragmentSize = 200,
            numberOfFragments = 3,
            requireFieldMatch = true
        )
    )
    SearchHits<ArtifactEsIndex> fullTextSearch(String keyword, Object filters, Pageable pageable);

    List<ArtifactEsIndex> findByCreateTimeBetween(LocalDateTime from, LocalDateTime to);

    long countByStatus(String status);
}
