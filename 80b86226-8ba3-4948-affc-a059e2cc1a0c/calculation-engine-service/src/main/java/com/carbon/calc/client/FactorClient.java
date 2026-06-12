package com.carbon.calc.client;

import com.carbon.common.api.R;
import com.carbon.common.enums.FactorLibrary;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@FeignClient(name = "factor-library-service", path = "/factors")
public interface FactorClient {

    @GetMapping("/match")
    R<Map<String, Object>> matchByPeriod(
            @RequestParam FactorLibrary library,
            @RequestParam String matchKey,
            @RequestParam String period);

    @GetMapping("/by-version")
    R<Map<String, Object>> byVersion(
            @RequestParam FactorLibrary library,
            @RequestParam String versionCode,
            @RequestParam String matchKey,
            @RequestParam(required = false) String gas);

    @PostMapping("/bulk-match")
    R<Map<String, Map<String, Object>>> bulkMatch(
            @RequestParam FactorLibrary library,
            @RequestParam String versionCode,
            @RequestBody List<String> matchKeys);
}
