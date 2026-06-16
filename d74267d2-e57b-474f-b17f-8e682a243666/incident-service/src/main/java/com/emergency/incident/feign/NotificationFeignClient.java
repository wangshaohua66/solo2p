package com.emergency.incident.feign;

import com.emergency.common.result.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@FeignClient(name = "notification-service", path = "/api/notification")
public interface NotificationFeignClient {

    @PostMapping("/notifications/send-incident-alert")
    Result<Long> sendIncidentAlert(@RequestParam Long incidentId);

    @PostMapping("/notifications/broadcast")
    Result<List<Long>> broadcastNotification(
            @RequestParam String title,
            @RequestParam String content,
            @RequestParam(required = false) String regionCode,
            @RequestParam(required = false) Integer incidentLevel);
}
