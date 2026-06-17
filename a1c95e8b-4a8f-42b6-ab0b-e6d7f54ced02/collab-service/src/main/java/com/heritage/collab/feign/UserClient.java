package com.heritage.collab.feign;

import com.heritage.collab.common.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

@FeignClient(name = "user-service", contextId = "collabUserClient", url = "${feign.user.url:}", path = "/api/auth")
public interface UserClient {

    @GetMapping("/users/{id}")
    Result<Map<String, Object>> getUserById(@PathVariable("id") String id);

    @GetMapping("/users/role/{role}")
    Result<java.util.List<Map<String, Object>>> listByRole(@PathVariable("role") String role);
}
