package com.heritage.auth.service.impl;

import com.heritage.auth.dto.LoginRequest;
import com.heritage.auth.dto.LoginResponse;
import com.heritage.auth.dto.RegisterRequest;
import com.heritage.auth.entity.User;
import com.heritage.auth.enums.RoleType;
import com.heritage.auth.repository.UserRepository;
import com.heritage.auth.service.AuthService;
import com.heritage.auth.util.JwtUtil;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Override
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
            .orElseThrow(() -> new RuntimeException("用户名或密码错误"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("用户名或密码错误");
        }

        if (!Boolean.TRUE.equals(user.getEnabled())) {
            throw new RuntimeException("账户已被禁用");
        }

        if (!Boolean.TRUE.equals(user.getAccountNonLocked())) {
            throw new RuntimeException("账户已被锁定");
        }

        user.setLastLoginTime(LocalDateTime.now());
        userRepository.save(user);

        return buildLoginResponse(user);
    }

    @Override
    public LoginResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("用户名已存在");
        }

        if (request.getEmail() != null && userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("邮箱已被注册");
        }

        if (request.getPhone() != null && userRepository.existsByPhone(request.getPhone())) {
            throw new RuntimeException("手机号已被注册");
        }

        User user = User.builder()
            .username(request.getUsername())
            .password(passwordEncoder.encode(request.getPassword()))
            .realName(request.getRealName())
            .email(request.getEmail())
            .phone(request.getPhone())
            .roles(request.getRoles())
            .department(request.getDepartment())
            .title(request.getTitle())
            .dataAccessLevel(calculateDataAccessLevel(request.getRoles()))
            .enabled(true)
            .accountNonLocked(true)
            .build();

        user = userRepository.save(user);
        log.info("User registered successfully: {}", user.getUsername());

        return buildLoginResponse(user);
    }

    @Override
    public LoginResponse refreshToken(String refreshToken) {
        Claims claims = jwtUtil.parseToken(refreshToken);
        if (claims == null || !"refresh".equals(claims.get("type", String.class))) {
            throw new RuntimeException("无效的刷新令牌");
        }

        String userId = claims.getSubject();
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("用户不存在"));

        return buildLoginResponse(user);
    }

    @Override
    public void logout(String token) {
        log.info("User logged out");
    }

    @Override
    public User getCurrentUser(String userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("用户不存在"));
    }

    private LoginResponse buildLoginResponse(User user) {
        String accessToken = jwtUtil.generateAccessToken(user);
        String refreshToken = jwtUtil.generateRefreshToken(user);

        return LoginResponse.builder()
            .accessToken(accessToken)
            .refreshToken(refreshToken)
            .tokenType("Bearer")
            .expiresIn(86400L)
            .user(LoginResponse.UserInfo.builder()
                .id(user.getId())
                .username(user.getUsername())
                .realName(user.getRealName())
                .email(user.getEmail())
                .avatar(user.getAvatar())
                .roles(user.getRoles().stream().map(RoleType::name).collect(Collectors.toSet()))
                .department(user.getDepartment())
                .title(user.getTitle())
                .dataAccessLevel(user.getDataAccessLevel())
                .build())
            .build();
    }

    private Integer calculateDataAccessLevel(java.util.Set<RoleType> roles) {
        if (roles.contains(RoleType.ADMIN)) return 5;
        if (roles.contains(RoleType.EXPERT)) return 4;
        if (roles.contains(RoleType.RESTORER)) return 3;
        if (roles.contains(RoleType.ARCHIVIST)) return 2;
        if (roles.contains(RoleType.INSPECTOR)) return 1;
        return 0;
    }
}
