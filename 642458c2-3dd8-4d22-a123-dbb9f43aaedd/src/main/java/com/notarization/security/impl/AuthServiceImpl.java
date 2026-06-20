package com.notarization.security.impl;

import com.notarization.dto.request.LoginRequest;
import com.notarization.exception.BusinessException;
import com.notarization.exception.ErrorCode;
import com.notarization.model.AccessToken;
import com.notarization.model.User;
import com.notarization.repository.AccessTokenRepository;
import com.notarization.repository.UserRepository;
import com.notarization.security.AuthService;
import com.notarization.security.CustomUserDetailsService;
import com.notarization.security.JwtTokenUtil;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class AuthServiceImpl implements AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenUtil jwtTokenUtil;
    private final CustomUserDetailsService userDetailsService;
    private final UserRepository userRepository;
    private final AccessTokenRepository accessTokenRepository;

    public AuthServiceImpl(AuthenticationManager authenticationManager,
                           JwtTokenUtil jwtTokenUtil,
                           CustomUserDetailsService userDetailsService,
                           UserRepository userRepository,
                           AccessTokenRepository accessTokenRepository) {
        this.authenticationManager = authenticationManager;
        this.jwtTokenUtil = jwtTokenUtil;
        this.userDetailsService = userDetailsService;
        this.userRepository = userRepository;
        this.accessTokenRepository = accessTokenRepository;
    }

    @Override
    public Map<String, Object> login(LoginRequest loginRequest) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword())
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (AuthenticationException e) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "用户名或密码错误");
        }

        User user = userRepository.findByUsername(loginRequest.getUsername())
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "用户不存在"));

        UserDetails userDetails = userDetailsService.loadUserByUsername(loginRequest.getUsername());
        String token = jwtTokenUtil.generateToken(userDetails, user.getId(), user.getRole(), user.getHallId());

        AccessToken accessToken = new AccessToken();
        accessToken.setToken(token);
        accessToken.setUserId(user.getId());
        accessToken.setRevoked(false);
        Date expirationDate = jwtTokenUtil.extractExpiration(token);
        accessToken.setExpiresAt(Instant.ofEpochMilli(expirationDate.getTime()));
        accessTokenRepository.save(accessToken);

        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("id", user.getId());
        userInfo.put("username", user.getUsername());
        userInfo.put("email", user.getEmail());
        userInfo.put("realName", user.getRealName());
        userInfo.put("role", user.getRole());
        userInfo.put("hallId", user.getHallId());

        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        result.put("user", userInfo);

        return result;
    }

    @Override
    public void logout(String token) {
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        Optional<AccessToken> accessTokenOpt = accessTokenRepository.findByToken(token);
        if (accessTokenOpt.isPresent()) {
            AccessToken accessToken = accessTokenOpt.get();
            accessToken.setRevoked(true);
            accessTokenRepository.save(accessToken);
        }
    }

    @Override
    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        Object principal = authentication.getPrincipal();
        String username;
        if (principal instanceof UserDetails) {
            username = ((UserDetails) principal).getUsername();
        } else {
            username = principal.toString();
        }
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "用户不存在"));
    }
}
