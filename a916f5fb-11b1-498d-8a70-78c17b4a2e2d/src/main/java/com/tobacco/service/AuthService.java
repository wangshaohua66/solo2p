package com.tobacco.service;

import com.tobacco.common.enums.RoleType;
import com.tobacco.common.exception.BusinessException;
import com.tobacco.common.result.ResultCode;
import com.tobacco.dto.request.LoginRequest;
import com.tobacco.dto.response.LoginResponse;
import com.tobacco.entity.User;
import com.tobacco.mapper.UserMapper;
import com.tobacco.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    public LoginResponse login(LoginRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getUsername(),
                            request.getPassword()
                    )
            );

            User user = userMapper.selectByUsername(request.getUsername());
            if (user == null) {
                throw new BusinessException(ResultCode.USER_NOT_FOUND);
            }
            if (user.getStatus() != 1) {
                throw new BusinessException(ResultCode.USER_DISABLED);
            }

            String accessToken = jwtTokenProvider.generateAccessToken(
                    user.getUsername(),
                    user.getRoleCode(),
                    user.getId()
            );
            String refreshToken = jwtTokenProvider.generateRefreshToken(user.getUsername());

            RoleType roleType = RoleType.getByRole(user.getRoleCode());

            return LoginResponse.builder()
                    .accessToken(accessToken)
                    .refreshToken(refreshToken)
                    .tokenType("Bearer")
                    .expiresIn(jwtTokenProvider.getExpiration())
                    .userInfo(LoginResponse.UserInfo.builder()
                            .id(user.getId())
                            .username(user.getUsername())
                            .realName(user.getRealName())
                            .roleCode(user.getRoleCode())
                            .roleName(roleType != null ? roleType.getName() : "")
                            .phone(user.getPhone())
                            .build())
                    .build();

        } catch (AuthenticationException e) {
            log.warn("登录失败，用户名或密码错误: {}", request.getUsername());
            throw new BusinessException(ResultCode.USER_PASSWORD_ERROR);
        }
    }

    public LoginResponse refreshToken(String refreshToken) {
        if (!jwtTokenProvider.validateRefreshToken(refreshToken)) {
            throw new BusinessException(ResultCode.TOKEN_REFRESH_FAILED);
        }

        String username = jwtTokenProvider.getUsernameFromToken(refreshToken);
        User user = userMapper.selectByUsername(username);
        if (user == null || user.getStatus() != 1) {
            throw new BusinessException(ResultCode.TOKEN_REFRESH_FAILED);
        }

        String newAccessToken = jwtTokenProvider.generateAccessToken(
                user.getUsername(),
                user.getRoleCode(),
                user.getId()
        );
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(user.getUsername());

        RoleType roleType = RoleType.getByRole(user.getRoleCode());

        return LoginResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpiration())
                .userInfo(LoginResponse.UserInfo.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .realName(user.getRealName())
                        .roleCode(user.getRoleCode())
                        .roleName(roleType != null ? roleType.getName() : "")
                        .phone(user.getPhone())
                        .build())
                .build();
    }

    public void logout() {
    }
}
