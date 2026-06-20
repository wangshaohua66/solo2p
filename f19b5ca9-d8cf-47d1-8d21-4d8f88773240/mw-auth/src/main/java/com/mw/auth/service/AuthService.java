package com.mw.auth.service;

import com.mw.auth.document.Account;
import com.mw.auth.dto.LoginRequest;
import com.mw.auth.dto.RefreshRequest;
import com.mw.auth.dto.RegisterRequest;
import com.mw.auth.dto.TokenResponse;
import com.mw.auth.repository.AccountRepository;
import com.mw.common.audit.AuditAction;
import com.mw.common.audit.Auditable;
import com.mw.common.exception.BusinessException;
import com.mw.common.response.ResultCode;
import com.mw.common.security.JwtUtil;
import com.mw.common.security.UserInfo;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Auditable(action = AuditAction.LOGIN, module = "auth", description = "用户登录", recordResult = false)
    public TokenResponse login(LoginRequest request) {
        Account account = accountRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BusinessException(ResultCode.UNAUTHORIZED, "账号或密码错误"));
        if (Boolean.FALSE.equals(account.getEnabled())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "账号已被禁用");
        }
        if (!passwordEncoder.matches(request.getPassword(), account.getPasswordHash())) {
            throw new BusinessException(ResultCode.UNAUTHORIZED, "账号或密码错误");
        }
        return buildTokens(account);
    }

    @Auditable(action = AuditAction.CREATE, module = "auth", description = "注册账号")
    public TokenResponse register(RegisterRequest request) {
        if (accountRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException(ResultCode.CONFLICT, "用户名已存在");
        }
        Account account = new Account();
        account.setUsername(request.getUsername());
        account.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        account.setRealName(request.getRealName());
        account.setOrgId(request.getOrgId());
        account.setOrgName(request.getOrgName());
        account.setRoles(request.getRoles());
        account.setEnabled(true);
        accountRepository.save(account);
        log.info("注册账号成功: username={}, orgId={}", account.getUsername(), account.getOrgId());
        return buildTokens(account);
    }

    public TokenResponse refresh(RefreshRequest request) {
        Claims claims = jwtUtil.parse(request.getRefreshToken());
        if (claims == null || !"refresh".equals(claims.get("type"))) {
            throw new BusinessException(ResultCode.UNAUTHORIZED, "刷新令牌无效或已过期");
        }
        String userId = claims.getSubject();
        Account account = accountRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ResultCode.NOT_FOUND, "账号不存在"));
        if (Boolean.FALSE.equals(account.getEnabled())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "账号已被禁用");
        }
        return buildTokens(account);
    }

    private TokenResponse buildTokens(Account account) {
        UserInfo userInfo = UserInfo.builder()
                .userId(account.getId())
                .username(account.getUsername())
                .realName(account.getRealName())
                .orgId(account.getOrgId())
                .orgName(account.getOrgName())
                .roles(account.getRoles() == null ? Set.of() : account.getRoles())
                .build();
        String access = jwtUtil.generateAccessToken(userInfo);
        String refresh = jwtUtil.generateRefreshToken(userInfo);
        return TokenResponse.builder()
                .accessToken(access)
                .refreshToken(refresh)
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getAccessTokenTtlSeconds())
                .userId(account.getId())
                .username(account.getUsername())
                .realName(account.getRealName())
                .orgId(account.getOrgId())
                .roles(userInfo.getRoles())
                .build();
    }
}
