package com.heritage.trace.feign;

import com.heritage.trace.common.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

@FeignClient(name = "artifact-service", contextId = "traceArtifactClient", configuration = FeignHeaderConfig.class)
public interface ArtifactClient {

    @GetMapping("/{id}")
    Result<Map<String, Object>> getById(@PathVariable("id") String id);
}
