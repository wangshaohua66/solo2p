package com.insurance.claim.security;

import com.insurance.claim.entity.User;
import com.insurance.claim.enums.RoleType;
import com.insurance.claim.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import java.util.Collections;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserMapper userMapper;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userMapper.selectByUsername(username);
        if (user == null) {
            log.warn("用户不存在: {}", username);
            throw new UsernameNotFoundException("用户不存在: " + username);
        }

        if (user.getStatus() == null || user.getStatus() != 1) {
            log.warn("用户已禁用: {}", username);
            throw new UsernameNotFoundException("用户已被禁用: " + username);
        }

        RoleType role = user.getRole();
        List<SimpleGrantedAuthority> authorities = Collections.singletonList(
                new SimpleGrantedAuthority(role.getAuthority())
        );

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),
                authorities
        );
    }

    public User getUserByUsername(String username) {
        return userMapper.selectByUsername(username);
    }
}
