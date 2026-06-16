package com.emergency.auth.service.impl;

import com.emergency.auth.dto.LoginRequest;
import com.emergency.auth.dto.LoginResponse;
import com.emergency.auth.entity.Organization;
import com.emergency.auth.entity.User;
import com.emergency.auth.mapper.OrganizationMapper;
import com.emergency.auth.mapper.UserMapper;
import com.emergency.auth.service.AuthService;
import com.emergency.auth.service.OrganizationService;
import com.emergency.common.dto.LoginUser;
import com.emergency.common.exception.BusinessException;
import com.emergency.common.result.ResultCode;
import com.emergency.common.util.SecurityUtils;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserMapper userMapper;
    private final OrganizationMapper organizationMapper;
    private final OrganizationService organizationService;
    private final PasswordEncoder passwordEncoder;
    private final StringRedisTemplate redisTemplate;

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private Long expiration;

    @Value("${jwt.refresh-expiration}")
    private Long refreshExpiration;

    private static final String TOKEN_BLACKLIST_PREFIX = "auth:token:blacklist:";
    private static final String LOGIN_FAIL_COUNT_PREFIX = "auth:login:fail:";
    private static final int MAX_LOGIN_FAIL = 5;
    private static final int LOCK_MINUTES = 30;

    private SecretKey getSecretKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public LoginResponse login(LoginRequest request) {
        String failKey = LOGIN_FAIL_COUNT_PREFIX + request.getUsername();
        String failCountStr = redisTemplate.opsForValue().get(failKey);
        int failCount = failCountStr != null ? Integer.parseInt(failCountStr) : 0;

        if (failCount >= MAX_LOGIN_FAIL) {
            throw new BusinessException(ResultCode.ERROR,
                    String.format("登录失败次数过多，账号已锁定%d分钟", LOCK_MINUTES));
        }

        User user = userMapper.selectByUsername(request.getUsername());
        if (user == null) {
            recordLoginFail(failKey, failCount);
            throw new BusinessException(ResultCode.AUTH_FAILED);
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            recordLoginFail(failKey, failCount);
            throw new BusinessException(ResultCode.AUTH_FAILED);
        }

        if (user.isAccountLocked()) {
            throw new BusinessException(ResultCode.USER_DISABLED, "账号已被临时锁定");
        }

        if (!user.isEnabled()) {
            throw new BusinessException(ResultCode.USER_DISABLED);
        }

        redisTemplate.delete(failKey);

        user.setLastLoginTime(LocalDateTime.now());
        user.setLoginFailCount(0);
        userMapper.updateById(user);

        LoginUser loginUser = buildLoginUser(user);
        String accessToken = generateToken(loginUser);
        String refreshToken = generateRefreshToken(user.getId());

        redisTemplate.opsForValue().set("auth:user:" + user.getId(), accessToken, expiration, TimeUnit.SECONDS);

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(expiration)
                .user(loginUser)
                .build();
    }

    private void recordLoginFail(String failKey, int failCount) {
        failCount++;
        redisTemplate.opsForValue().set(failKey, String.valueOf(failCount), LOCK_MINUTES, TimeUnit.MINUTES);
    }

    @Override
    public void logout(String token) {
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }
        Claims claims = getClaims(token);
        if (claims != null) {
            String jti = claims.getId();
            Long expireTime = claims.getExpiration().getTime() - System.currentTimeMillis();
            if (expireTime > 0) {
                redisTemplate.opsForValue().set(TOKEN_BLACKLIST_PREFIX + jti, "1", expireTime, TimeUnit.MILLISECONDS);
            }
            Long userId = claims.get("userId", Long.class);
            redisTemplate.delete("auth:user:" + userId);
        }
    }

    @Override
    public LoginResponse refreshToken(String refreshToken) {
        Claims claims = getClaims(refreshToken);
        if (claims == null) {
            throw new BusinessException(ResultCode.TOKEN_INVALID);
        }

        Long userId = claims.get("userId", Long.class);
        String storedRefreshToken = redisTemplate.opsForValue().get("auth:refresh:" + userId);
        if (!refreshToken.equals(storedRefreshToken)) {
            throw new BusinessException(ResultCode.TOKEN_INVALID);
        }

        User user = userMapper.selectById(userId);
        if (user == null || !user.isEnabled()) {
            throw new BusinessException(ResultCode.USER_DISABLED);
        }

        LoginUser loginUser = buildLoginUser(user);
        String accessToken = generateToken(loginUser);
        String newRefreshToken = generateRefreshToken(userId);

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .expiresIn(expiration)
                .user(loginUser)
                .build();
    }

    @Override
    public LoginUser buildLoginUser(User user) {
        Organization org = organizationMapper.selectById(user.getOrganizationId());
        List<String> roleCodes = userMapper.selectRoleCodesByUserId(user.getId());
        List<String> permissions = userMapper.selectPermissionsByUserId(user.getId());

        List<Long> accessibleOrgIds = new ArrayList<>();
        for (String roleCode : roleCodes) {
            if ("ADMIN".equals(roleCode) || "PROVINCE_ADMIN".equals(roleCode)) {
                accessibleOrgIds = organizationService.getChildOrgIds(1L);
                break;
            } else if ("CITY_ADMIN".equals(roleCode)) {
                accessibleOrgIds = organizationService.getChildOrgIds(user.getOrganizationId());
                break;
            } else {
                accessibleOrgIds.add(user.getOrganizationId());
            }
        }

        return LoginUser.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .realName(user.getRealName())
                .phone(user.getPhone())
                .email(user.getEmail())
                .organizationId(user.getOrganizationId())
                .organizationCode(org != null ? org.getCode() : null)
                .organizationName(org != null ? org.getName() : null)
                .organizationLevel(org != null ? org.getLevel().getCode() : 3)
                .regionCode(user.getRegionCode())
                .accessibleOrgIds(accessibleOrgIds)
                .roles(new HashSet<>(roleCodes))
                .permissions(new HashSet<>(permissions))
                .expireTime(System.currentTimeMillis() + expiration * 1000)
                .build();
    }

    @Override
    public User getCurrentUser() {
        Long userId = SecurityUtils.getCurrentUserId();
        if (userId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        return userMapper.selectById(userId);
    }

    @Override
    public String generateToken(LoginUser loginUser) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", loginUser.getUserId());
        claims.put("username", loginUser.getUsername());
        claims.put("organizationId", loginUser.getOrganizationId());
        claims.put("organizationLevel", loginUser.getOrganizationLevel());
        claims.put("regionCode", loginUser.getRegionCode());
        claims.put("roles", loginUser.getRoles());
        claims.put("permissions", loginUser.getPermissions());

        return Jwts.builder()
                .claims(claims)
                .id(UUID.randomUUID().toString())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration * 1000))
                .signWith(getSecretKey())
                .compact();
    }

    private String generateRefreshToken(Long userId) {
        String refreshToken = Jwts.builder()
                .claim("userId", userId)
                .id(UUID.randomUUID().toString())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshExpiration * 1000))
                .signWith(getSecretKey())
                .compact();

        redisTemplate.opsForValue().set("auth:refresh:" + userId, refreshToken, refreshExpiration, TimeUnit.SECONDS);
        return refreshToken;
    }

    private Claims getClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(getSecretKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (Exception e) {
            return null;
        }
    }
}
