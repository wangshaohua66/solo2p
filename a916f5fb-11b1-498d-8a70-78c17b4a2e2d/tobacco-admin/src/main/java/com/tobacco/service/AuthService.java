package com.tobacco.service;

import com.tobacco.common.enums.RoleType;
import com.tobacco.common.exception.BusinessException;
import com.tobacco.common.result.ResultCode;
import com.tobacco.common.util.SecurityUtil;
import com.tobacco.dto.request.LoginRequest;
import com.tobacco.dto.response.LoginResponse;
import com.tobacco.entity.TokenBlacklist;
import com.tobacco.entity.User;
import com.tobacco.mapper.TokenBlacklistMapper;
import com.tobacco.mapper.UserMapper;
import com.tobacco.security.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final TokenBlacklistMapper tokenBlacklistMapper;
    private final SecurityUtil securityUtil;

    @Value("${jwt.prefix}")
    private String tokenPrefix;

    @Value("${jwt.header}")
    private String tokenHeader;

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
                    .expiresIn(jwtTokenProvider.getExpiration() / 1000)
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

        if (tokenBlacklistMapper.countByToken(refreshToken) > 0) {
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
                .expiresIn(jwtTokenProvider.getExpiration() / 1000)
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

    @Transactional(rollbackFor = Exception.class)
    public void logout() {
        String token = getCurrentToken();
        if (token == null) {
            return;
        }

        addToBlacklist(token);

        log.info("用户登出成功，token已加入黑名单");
    }

    private String getCurrentToken() {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) {
            return null;
        }
        HttpServletRequest request = attrs.getRequest();
        String authHeader = request.getHeader(tokenHeader);
        if (authHeader != null && authHeader.startsWith(tokenPrefix + " ")) {
            return authHeader.substring(tokenPrefix.length() + 1);
        }
        return null;
    }

    private void addToBlacklist(String token) {
        Claims claims = jwtTokenProvider.getClaimsFromToken(token);
        if (claims == null) {
            return;
        }

        Date expiration = claims.getExpiration();
        LocalDateTime expireTime = expiration.toInstant()
                .atZone(ZoneId.systemDefault())
                .toLocalDateTime();

        String username = (String) claims.get("username");
        String type = (String) claims.get("type");

        TokenBlacklist blacklist = new TokenBlacklist();
        blacklist.setToken(token);
        blacklist.setTokenType(type);
        blacklist.setUsername(username);
        blacklist.setExpireTime(expireTime);
        tokenBlacklistMapper.insert(blacklist);
    }
}
