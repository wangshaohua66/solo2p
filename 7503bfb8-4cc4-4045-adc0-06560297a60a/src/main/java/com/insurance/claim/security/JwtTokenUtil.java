package com.insurance.claim.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
public class JwtTokenUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private Long expiration;

    @Value("${jwt.header}")
    private String header;

    @Value("${jwt.prefix}")
    private String prefix;

    private SecretKey getSigningKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(Long userId, String username, String role, String realName) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("username", username);
        claims.put("role", role);
        claims.put("realName", realName);
        claims.put("created", new Date());
        return generateToken(claims);
    }

    private String generateToken(Map<String, Object> claims) {
        Date createdDate = new Date();
        Date expirationDate = new Date(createdDate.getTime() + expiration);
        return Jwts.builder()
                .setClaims(claims)
                .setSubject((String) claims.get("username"))
                .setIssuedAt(createdDate)
                .setExpiration(expirationDate)
                .signWith(getSigningKey(), SignatureAlgorithm.HS512)
                .compact();
    }

    public Claims getClaimsFromToken(String token) {
        try {
            return Jwts.parserBuilder()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
        } catch (ExpiredJwtException e) {
            log.warn("JWT令牌已过期: {}", e.getMessage());
            throw e;
        } catch (JwtException e) {
            log.warn("JWT令牌无效: {}", e.getMessage());
            throw e;
        }
    }

    public String getUsernameFromToken(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            return claims.getSubject();
        } catch (Exception e) {
            return null;
        }
    }

    public Long getUserIdFromToken(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            Object userId = claims.get("userId");
            return userId != null ? Long.valueOf(userId.toString()) : null;
        } catch (Exception e) {
            return null;
        }
    }

    public String getRoleFromToken(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            return (String) claims.get("role");
        } catch (Exception e) {
            return null;
        }
    }

    public Boolean isTokenExpired(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            Date expiration = claims.getExpiration();
            return expiration.before(new Date());
        } catch (Exception e) {
            return true;
        }
    }

    public Boolean validateToken(String token, String username) {
        try {
            String tokenUsername = getUsernameFromToken(token);
            return (username.equals(tokenUsername) && !isTokenExpired(token));
        } catch (Exception e) {
            return false;
        }
    }

    public Long getExpiration() {
        return expiration / 1000;
    }

    public String getHeader() {
        return header;
    }

    public String getPrefix() {
        return prefix;
    }
}
