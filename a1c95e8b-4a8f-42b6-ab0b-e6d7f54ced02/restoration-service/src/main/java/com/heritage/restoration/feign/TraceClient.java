package com.heritage.restoration.feign;

import com.heritage.restoration.common.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

@FeignClient(name = "trace-service", contextId = "traceClient")
public interface TraceClient {

    @PostMapping("/records")
    Result<Map<String, Object>> createRecord(@RequestBody Map<String, Object> record);
}
