package com.carbon.calc.client;

import com.carbon.common.api.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@FeignClient(name = "emission-source-service")
public interface EmissionSourceClient {

    @GetMapping("/emission-sources/brief")
    R<List<Map<String, Object>>> listBriefSources();

    @GetMapping("/activity-data")
    R<Map<String, Object>> listActivityData(
            @RequestParam(required = false) String period,
            @RequestParam(required = false) String sourceId,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "1000") Integer size);

    @GetMapping("/activity-data/summary")
    R<Map<String, Object>> activitySummary(@RequestParam Integer year, @RequestParam Integer month);
}
