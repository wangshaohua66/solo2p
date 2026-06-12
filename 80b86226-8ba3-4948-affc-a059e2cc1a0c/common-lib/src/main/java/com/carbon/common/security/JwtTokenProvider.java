package com.carbon.common.security;

import com.carbon.common.api.ErrorCode;
import com.carbon.common.context.UserContextHolder;
import com.carbon.common.exception.UnauthorizedException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
public class JwtTokenProvider {

    private static final String CLAIM_USER_ID = "uid";
    private static final String CLAIM_USERNAME = "username";
    private static final String CLAIM_TENANT_ID = "tid";
    private static final String CLAIM_TENANT_NAME = "tname";
    private static final String CLAIM_ORG_ID = "oid";
    private static final String CLAIM_ROLES = "roles";
    private static final String CLAIM_PERMISSIONS = "perms";

    private final SecretKey secretKey;
    private final long expirationMs;

    public JwtTokenProvider(
            @Value("${security.jwt.secret:carbon-management-platform-super-secret-key-2024}") String secret,
            @Value("${security.jwt.expiration-ms:86400000}") long expirationMs) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String createToken(UserContextHolder.CurrentUser user) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(user.getUserId())
                .claim(CLAIM_USER_ID, user.getUserId())
                .claim(CLAIM_USERNAME, user.getUsername())
                .claim(CLAIM_TENANT_ID, user.getTenantId())
                .claim(CLAIM_TENANT_NAME, user.getTenantName())
                .claim(CLAIM_ORG_ID, user.getOrganizationId())
                .claim(CLAIM_ROLES, user.getRoles())
                .claim(CLAIM_PERMISSIONS, user.getPermissions())
                .issuedAt(new Date(now))
                .expiration(new Date(now + expirationMs))
                .signWith(secretKey)
                .compact();
    }

    @SuppressWarnings("unchecked")
    public UserContextHolder.CurrentUser parseToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            return UserContextHolder.CurrentUser.builder()
                    .userId(claims.get(CLAIM_USER_ID, String.class))
                    .username(claims.get(CLAIM_USERNAME, String.class))
                    .tenantId(claims.get(CLAIM_TENANT_ID, String.class))
                    .tenantName(claims.get(CLAIM_TENANT_NAME, String.class))
                    .organizationId(claims.get(CLAIM_ORG_ID, String.class))
                    .roles(new HashSet<>((List<String>) claims.getOrDefault(CLAIM_ROLES, Collections.emptyList())))
                    .permissions(new HashSet<>((List<String>) claims.getOrDefault(CLAIM_PERMISSIONS, Collections.emptyList())))
                    .issuedAt(claims.getIssuedAt() != null ? claims.getIssuedAt().getTime() : null)
                    .expiresAt(claims.getExpiration() != null ? claims.getExpiration().getTime() : null)
                    .build();
        } catch (JwtException e) {
            if (e.getMessage() != null && e.getMessage().contains("expire")) {
                throw new UnauthorizedException(ErrorCode.TOKEN_EXPIRED, "Token已过期，请重新登录");
            }
            throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, "Token无效");
        }
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(secretKey).build().parseSignedClaims(token);
            return true;
        } catch (JwtException e) {
            return false;
        }
    }
}
