package com.iccert.common.utils;

import cn.hutool.core.util.IdUtil;
import cn.hutool.crypto.digest.DigestUtil;
import com.iccert.common.exception.BusinessException;
import com.iccert.common.result.ResultCode;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

public class JwtUtils {

    private static final String SECRET = "ICCert-Inspection-Certification-Center-Secret-Key-2024";
    private static final long EXPIRATION_HOURS = 12;
    private static final SecretKey KEY = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));

    public static String generateToken(Long userId, String username, String roleCode) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("username", username);
        claims.put("roleCode", roleCode);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime exp = now.plusHours(EXPIRATION_HOURS);
        return Jwts.builder()
                .claims(claims)
                .subject(username)
                .issuedAt(Date.from(now.atZone(ZoneId.systemDefault()).toInstant()))
                .expiration(Date.from(exp.atZone(ZoneId.systemDefault()).toInstant()))
                .id(IdUtil.fastSimpleUUID())
                .signWith(KEY)
                .compact();
    }

    public static Claims parseToken(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(KEY)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            throw new BusinessException(ResultCode.TOKEN_EXPIRED);
        } catch (JwtException e) {
            throw new BusinessException(ResultCode.TOKEN_INVALID);
        }
    }

    public static Long getUserId(String token) {
        Claims claims = parseToken(token);
        return claims.get("userId", Long.class);
    }

    public static String getUsername(String token) {
        Claims claims = parseToken(token);
        return claims.getSubject();
    }

    public static String getRoleCode(String token) {
        Claims claims = parseToken(token);
        return claims.get("roleCode", String.class);
    }

    public static boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public static String sha256(String input) {
        return DigestUtil.sha256Hex(input);
    }

    public static String hashChain(String prevHash, String... data) {
        StringBuilder sb = new StringBuilder();
        if (prevHash != null) sb.append(prevHash);
        for (String d : data) sb.append(d == null ? "" : d);
        return DigestUtil.sha256Hex(sb.toString());
    }

    public static boolean verifyHashChain(String expectedHash, String prevHash, String... data) {
        if (expectedHash == null || expectedHash.isEmpty()) return false;
        return expectedHash.equals(hashChain(prevHash, data));
    }
}
