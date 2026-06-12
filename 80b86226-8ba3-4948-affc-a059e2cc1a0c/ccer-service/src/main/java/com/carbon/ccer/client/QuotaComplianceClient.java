package com.carbon.ccer.client;

import com.carbon.common.api.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

@FeignClient(name = "quota-compliance-service", path = "/api/quotas")
public interface QuotaComplianceClient {

    @PostMapping("/ccer-transfers/auto-transfer")
    R<Map<String, Object>> autoTransferIssuanceToQuota(@RequestBody Map<String, Object> request);
}
