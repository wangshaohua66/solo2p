package com.glassstudio.service;

import com.glassstudio.dto.LoginRequest;
import com.glassstudio.dto.LoginResponse;
import com.glassstudio.entity.Member;
import com.glassstudio.exception.UnauthorizedException;
import com.glassstudio.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final MemberRepository memberRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;

    public LoginResponse login(LoginRequest request) {
        Member member = memberRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new UnauthorizedException("用户名或密码错误"));

        if (!passwordEncoder.matches(request.getPassword(), member.getPasswordHash())) {
            throw new UnauthorizedException("用户名或密码错误");
        }

        String token = jwtTokenProvider.generateToken(member.getUsername());

        return LoginResponse.builder()
                .token(token)
                .user(member)
                .build();
    }

    public Member getCurrentUser(String username) {
        return memberRepository.findByUsername(username)
                .orElseThrow(() -> new UnauthorizedException("用户不存在"));
    }
}
