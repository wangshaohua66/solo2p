package com.heritage.artifact.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@RefreshScope
@ConfigurationProperties(prefix = "artifact.search")
public class ArtifactSearchProperties {

    private boolean useElasticsearch = true;
    private boolean fallbackToMongo = true;
    private String highlightPreTags = "<mark>";
    private String highlightPostTags = "</mark>";
    private int maxResultWindow = 10000;
}
