package com.heritage.artifact.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.elasticsearch.client.ClientConfiguration;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchConfiguration;

import java.time.Duration;

@Data
@Configuration
@RefreshScope
@ConfigurationProperties(prefix = "spring.data.elasticsearch")
public class ElasticsearchConfig extends ElasticsearchConfiguration {

    private String uris = "localhost:9200";
    private String username = "elastic";
    private String password = "elastic123";
    private Duration socketTimeout = Duration.ofSeconds(30);
    private Duration connectionTimeout = Duration.ofSeconds(5);

    @Override
    public ClientConfiguration clientConfiguration() {
        String[] hosts = uris.split(",");
        ClientConfiguration.MaybeSecureClientConfigurationBuilder builder = ClientConfiguration.builder()
            .connectedTo(hosts)
            .withConnectTimeout(connectionTimeout)
            .withSocketTimeout(socketTimeout);
        if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
            builder = builder.withBasicAuth(username, password);
        }
        return builder.build();
    }
}
