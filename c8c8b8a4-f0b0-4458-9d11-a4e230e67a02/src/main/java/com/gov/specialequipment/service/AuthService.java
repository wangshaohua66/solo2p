package com.gov.specialequipment.service;

import com.gov.specialequipment.dto.LoginDTO;
import com.gov.specialequipment.entity.SysUser;
import com.gov.specialequipment.enums.RoleEnum;
import com.gov.specialequipment.exception.BusinessException;
import com.gov.specialequipment.util.JwtUtil;
import com.gov.specialequipment.vo.LoginVO;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;

    @Value("${jwt.expiration}")
    private Long expiration;

    public LoginVO login(LoginDTO dto) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(dto.getUsername(), dto.getPassword())
        );

        Object principal = authentication.getPrincipal();
        if (!(principal instanceof com.gov.specialequipment.security.CustomUserDetails)) {
            throw new BusinessException("认证失败");
        }

        com.gov.specialequipment.security.CustomUserDetails userDetails =
                (com.gov.specialequipment.security.CustomUserDetails) principal;
        SysUser user = userDetails.getSysUser();

        if (user.getStatus() != 1) {
            throw new BusinessException("账号已被禁用");
        }

        String token = jwtUtil.generateToken(
                user.getId(),
                user.getUsername(),
                user.getRoleCode(),
                user.getOrganizationId()
        );

        LoginVO vo = new LoginVO();
        vo.setToken(token);
        vo.setTokenType("Bearer");
        vo.setExpiresIn(expiration / 1000);
        vo.setUserId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setRealName(user.getRealName());
        vo.setRoleCode(user.getRoleCode());
        vo.setRoleName(getRoleName(user.getRoleCode()));
        vo.setOrganizationId(user.getOrganizationId());
        vo.setOrganizationName(user.getOrganizationName());

        return vo;
    }

    private String getRoleName(String roleCode) {
        for (RoleEnum role : RoleEnum.values()) {
            if (role.getCode().equals(roleCode)) {
                return role.getDesc();
            }
        }
        return roleCode;
    }
}
