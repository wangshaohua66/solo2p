package com.tobacco.feign;

import com.tobacco.common.result.Result;
import com.tobacco.dto.request.LoginRequest;
import com.tobacco.dto.response.LoginResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "tobacco-admin", path = "/auth")
public interface AuthFeignClient {

    @PostMapping("/login")
    Result<LoginResponse> login(@RequestBody LoginRequest request);

    @PostMapping("/logout")
    Result<Void> logout();
}
