package com.insurance.claim.service;

import com.insurance.claim.common.BusinessException;
import com.insurance.claim.common.ResultCode;
import com.insurance.claim.dto.request.LoginRequest;
import com.insurance.claim.dto.response.LoginResponse;
import com.insurance.claim.entity.User;
import com.insurance.claim.mapper.UserMapper;
import com.insurance.claim.security.JwtTokenUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.Collections;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenUtil jwtTokenUtil;
    private final UserMapper userMapper;

    public LoginResponse login(LoginRequest request, String clientIp) {
        log.info("用户登录: {}", request.getUsername());

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getUsername(),
                            request.getPassword()
                    )
            );

            SecurityContextHolder.getContext().setAuthentication(authentication);

            User user = userMapper.selectByUsername(request.getUsername());
            if (user == null) {
                throw new BusinessException(ResultCode.USER_NOT_FOUND);
            }

            if (user.getStatus() == null || user.getStatus() != 1) {
                throw new BusinessException("用户已被禁用");
            }

            String token = jwtTokenUtil.generateToken(
                    user.getId(),
                    user.getUsername(),
                    user.getRole().getAuthority(),
                    user.getRealName()
            );

            userMapper.updateLastLogin(user.getId(), LocalDateTime.now(), clientIp);

            log.info("用户登录成功: {} - {}", user.getUsername(), user.getRealName());

            return LoginResponse.builder()
                    .token(token)
                    .tokenType("Bearer")
                    .expiresIn(jwtTokenUtil.getExpiration())
                    .userId(user.getId())
                    .username(user.getUsername())
                    .realName(user.getRealName())
                    .role(user.getRole().getAuthority())
                    .roleName(user.getRole().getDescription())
                    .branchCode(user.getBranchCode())
                    .branchName(user.getBranchName())
                    .permissions(Collections.singletonList(user.getRole().getAuthority()))
                    .loginTime(LocalDateTime.now())
                    .build();

        } catch (BadCredentialsException e) {
            log.warn("登录失败，用户名或密码错误: {}", request.getUsername());
            throw new BusinessException(ResultCode.LOGIN_FAILED);
        }
    }

    public void logout(String token) {
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }
        String username = jwtTokenUtil.getUsernameFromToken(token);
        log.info("用户登出: {}", username);
        SecurityContextHolder.clearContext();
    }

    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        String username = authentication.getName();
        User user = userMapper.selectByUsername(username);
        if (user == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        return user;
    }

    public boolean validateToken(String token) {
        try {
            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
            }
            String username = jwtTokenUtil.getUsernameFromToken(token);
            return username != null && !jwtTokenUtil.isTokenExpired(token);
        } catch (Exception e) {
            return false;
        }
    }

    public String refreshToken(String oldToken) {
        if (oldToken != null && oldToken.startsWith("Bearer ")) {
            oldToken = oldToken.substring(7);
        }

        try {
            String username = jwtTokenUtil.getUsernameFromToken(oldToken);
            User user = userMapper.selectByUsername(username);
            if (user == null) {
                throw new BusinessException(ResultCode.USER_NOT_FOUND);
            }

            if (jwtTokenUtil.isTokenExpired(oldToken)) {
                throw new BusinessException(ResultCode.TOKEN_EXPIRED.getCode(), "令牌已过期，请重新登录");
            }

            String newToken = jwtTokenUtil.generateToken(
                    user.getId(),
                    user.getUsername(),
                    user.getRole().getAuthority(),
                    user.getRealName()
            );

            log.info("令牌刷新成功: {}", username);
            return newToken;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("令牌刷新失败: {}", e.getMessage());
            throw new BusinessException(ResultCode.TOKEN_INVALID);
        }
    }
}
