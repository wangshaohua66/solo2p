package com.crew.security;

import com.crew.common.BusinessException;
import com.crew.common.ErrorCode;
import com.crew.entity.SysUser;
import com.crew.mapper.SysUserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final SysUserMapper sysUserMapper;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        SysUser sysUser = sysUserMapper.selectOne(
                new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, username)
        );

        if (sysUser == null) {
            throw new UsernameNotFoundException("用户不存在: " + username);
        }

        if (!Boolean.TRUE.equals(sysUser.getEnabled())) {
            throw new BusinessException(ErrorCode.AUTH_UNAUTHORIZED);
        }

        List<SimpleGrantedAuthority> authorities =
                List.of(new SimpleGrantedAuthority("ROLE_" + sysUser.getRole()));

        return new User(sysUser.getUsername(), sysUser.getPassword(), authorities);
    }
}
