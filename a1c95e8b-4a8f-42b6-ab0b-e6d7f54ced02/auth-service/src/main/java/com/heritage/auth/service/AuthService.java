package com.heritage.auth.service;

import com.heritage.auth.dto.LoginRequest;
import com.heritage.auth.dto.LoginResponse;
import com.heritage.auth.dto.RegisterRequest;
import com.heritage.auth.entity.User;

public interface AuthService {

    LoginResponse login(LoginRequest request);

    LoginResponse register(RegisterRequest request);

    LoginResponse refreshToken(String refreshToken);

    void logout(String token);

    User getCurrentUser(String userId);
}
