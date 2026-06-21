package com.gov.specialequipment.security;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.gov.specialequipment.entity.SysUser;
import com.gov.specialequipment.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final SysUserMapper sysUserMapper;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        SysUser user = sysUserMapper.selectOne(
                new LambdaQueryWrapper<SysUser>()
                        .eq(SysUser::getUsername, username)
                        .eq(SysUser::getDeleted, 0)
        );
        if (user == null) {
            throw new UsernameNotFoundException("用户不存在: " + username);
        }
        return new CustomUserDetails(user);
    }
}
