package com.heritage.restoration.feign;

import com.heritage.restoration.common.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@FeignClient(name = "auth-service", contextId = "userClient")
public interface UserClient {

    @GetMapping("/users/{id}")
    Result<Map<String, Object>> getUser(@PathVariable("id") String id);

    @GetMapping("/users")
    Result<Map<String, Object>> listUsers(@RequestParam("role") String role,
                                          @RequestParam("page") int page,
                                          @RequestParam("size") int size);

    @PostMapping("/users/batch")
    Result<List<Map<String, Object>>> batchUsers(@RequestBody List<String> ids);
}
