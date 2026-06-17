package com.heritage.restoration.feign;

import com.heritage.restoration.common.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

@FeignClient(name = "artifact-service", contextId = "artifactClient")
public interface ArtifactClient {

    @GetMapping("/{id}")
    Result<Map<String, Object>> getById(@PathVariable("id") String id);

    @GetMapping("/code/{code}")
    Result<Map<String, Object>> getByCode(@PathVariable("code") String code);

    @PutMapping("/{id}/status")
    Result<Void> updateStatus(@PathVariable("id") String id, @RequestBody Map<String, String> status);
}
