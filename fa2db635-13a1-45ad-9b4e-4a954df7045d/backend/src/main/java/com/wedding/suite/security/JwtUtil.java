package com.wedding.suite.security;

import com.wedding.suite.config.JwtProperties;
import com.wedding.suite.enums.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Date;

@Component
public class JwtUtil {

    private final JwtProperties props;
    private final SecretKey key;

    public JwtUtil(JwtProperties props) {
        this.props = props;
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(props.getSecret());
        } catch (IllegalArgumentException ex) {
            bytes = props.getSecret().getBytes(StandardCharsets.UTF_8);
        }
        if (bytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(bytes, 0, padded, 0, Math.min(bytes.length, 32));
            bytes = padded;
        }
        this.key = Keys.hmacShaKeyFor(bytes);
    }

    public String generate(Long userId, String name, UserRole role, Long storeId) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + props.getAccessTokenTtl() * 1000L);
        return Jwts.builder()
                .issuer(props.getIssuer())
                .subject(name)
                .claim("uid", userId)
                .claim("role", role.name())
                .claim("storeId", storeId)
                .issuedAt(now)
                .expiration(exp)
                .signWith(key)
                .compact();
    }

    private Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isValid(String token) {
        try {
            parse(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public Long extractUserId(String token) {
        return parse(token).get("uid", Long.class);
    }

    public String extractName(String token) {
        return parse(token).getSubject();
    }

    public UserRole extractRole(String token) {
        return UserRole.valueOf(parse(token).get("role", String.class));
    }

    public Long extractStoreId(String token) {
        Object v = parse(token).get("storeId");
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        return Long.valueOf(v.toString());
    }
}
