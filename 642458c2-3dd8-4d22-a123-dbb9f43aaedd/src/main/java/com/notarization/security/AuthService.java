package com.notarization.security;

import com.notarization.dto.request.LoginRequest;
import com.notarization.model.User;

import java.util.Map;

public interface AuthService {

    Map<String, Object> login(LoginRequest loginRequest);

    void logout(String token);

    User getCurrentUser();
}
