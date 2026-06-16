package com.emergency.auth.service;

import com.emergency.auth.dto.LoginRequest;
import com.emergency.auth.dto.LoginResponse;
import com.emergency.auth.entity.User;
import com.emergency.common.dto.LoginUser;

public interface AuthService {

    LoginResponse login(LoginRequest request);

    void logout(String token);

    LoginResponse refreshToken(String refreshToken);

    LoginUser buildLoginUser(User user);

    User getCurrentUser();

    String generateToken(LoginUser loginUser);
}
