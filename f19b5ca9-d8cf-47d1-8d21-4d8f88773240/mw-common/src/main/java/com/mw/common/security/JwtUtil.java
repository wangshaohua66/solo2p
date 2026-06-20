package com.mw.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Component
public class JwtUtil {

    private static final String CLAIM_ORG_ID = "orgId";
    private static final String CLAIM_ORG_NAME = "orgName";
    private static final String CLAIM_ROLES = "roles";
    private static final String CLAIM_REAL_NAME = "realName";

    @Value("${mw.security.jwt.secret:mw-medical-waste-secret-key-2024-trace-platform}")
    private String secret;

    @Value("${mw.security.jwt.access-token-ttl:7200}")
    private long accessTokenTtlSeconds;

    @Value("${mw.security.jwt.refresh-token-ttl:604800}")
    private long refreshTokenTtlSeconds;

    private SecretKey key() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(UserInfo user) {
        return buildToken(user, accessTokenTtlSeconds, "access");
    }

    public String generateRefreshToken(UserInfo user) {
        return buildToken(user, refreshTokenTtlSeconds, "refresh");
    }

    private String buildToken(UserInfo user, long ttlSeconds, String type) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + ttlSeconds * 1000L);
        Map<String, Object> claims = new HashMap<>();
        claims.put(CLAIM_ORG_ID, user.getOrgId());
        claims.put(CLAIM_ORG_NAME, user.getOrgName());
        claims.put(CLAIM_ROLES, user.getRoles());
        claims.put(CLAIM_REAL_NAME, user.getRealName());
        claims.put("type", type);
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .claims(claims)
                .subject(user.getUserId())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key())
                .compact();
    }

    public Claims parse(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("JWT解析失败: {}", e.getMessage());
            return null;
        }
    }

    public UserInfo toUserInfo(Claims claims) {
        if (claims == null) {
            return null;
        }
        Object rolesObj = claims.get(CLAIM_ROLES);
        Set<String> roles;
        if (rolesObj instanceof List<?> list) {
            roles = list.stream().map(String::valueOf).collect(Collectors.toSet());
        } else {
            roles = Set.of();
        }
        return UserInfo.builder()
                .userId(claims.getSubject())
                .username(String.valueOf(claims.getOrDefault("realName", claims.getSubject())))
                .realName(String.valueOf(claims.getOrDefault(CLAIM_REAL_NAME, "")))
                .orgId(String.valueOf(claims.getOrDefault(CLAIM_ORG_ID, "")))
                .orgName(String.valueOf(claims.getOrDefault(CLAIM_ORG_NAME, "")))
                .roles(roles)
                .build();
    }

    public boolean isAccessToken(Claims claims) {
        return claims != null && "access".equals(claims.get("type"));
    }

    public long getAccessTokenTtlSeconds() {
        return accessTokenTtlSeconds;
    }
}
