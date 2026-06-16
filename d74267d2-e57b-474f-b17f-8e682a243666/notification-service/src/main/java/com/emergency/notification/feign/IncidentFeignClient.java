package com.emergency.notification.feign;

import com.emergency.common.result.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "incident-service", path = "/api/incident")
public interface IncidentFeignClient {

    @GetMapping("/incidents/{id}")
    Result<?> getIncidentById(@PathVariable Long id);
}
