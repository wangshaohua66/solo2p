package com.wedding.suite.security;

import com.wedding.suite.common.SecurityUser;
import com.wedding.suite.entity.UserEntity;
import com.wedding.suite.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        UserEntity u = userRepository.findByName(username)
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在: " + username));
        return new SecurityUser(u.getId(), u.getName(), u.getRole(), u.getStoreId(), u.getPassword());
    }
}
