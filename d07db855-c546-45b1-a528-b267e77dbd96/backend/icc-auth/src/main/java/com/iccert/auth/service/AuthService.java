package com.iccert.auth.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.iccert.auth.dto.LoginDTO;
import com.iccert.auth.entity.SysMenu;
import com.iccert.auth.entity.SysRole;
import com.iccert.auth.entity.SysUser;
import com.iccert.auth.mapper.SysMenuMapper;
import com.iccert.auth.mapper.SysRoleMapper;
import com.iccert.auth.mapper.SysUserMapper;
import com.iccert.auth.vo.LoginVO;
import com.iccert.auth.vo.MenuVO;
import com.iccert.common.exception.BusinessException;
import com.iccert.common.result.ResultCode;
import com.iccert.common.utils.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final SysUserMapper userMapper;
    private final SysMenuMapper menuMapper;
    private final SysRoleMapper roleMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public LoginVO login(LoginDTO dto) {
        SysUser user = userMapper.selectOne(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, dto.getUsername())
                .eq(SysUser::getIsDeleted, 0));
        if (user == null || !passwordEncoder.matches(dto.getPassword(), user.getPassword())) {
            throw new BusinessException(ResultCode.LOGIN_ERROR);
        }
        if (user.getStatus() != 1) {
            throw new BusinessException(ResultCode.USER_DISABLED);
        }

        List<String> roleCodes = userMapper.selectRoleCodesByUserId(user.getId());
        String primaryRole = roleCodes.isEmpty() ? "CUSTOMER" : roleCodes.get(0);
        List<String> permissions = userMapper.selectPermissionsByUserId(user.getId());
        List<MenuVO> menus = buildUserMenuTree(user.getId());

        String token = JwtUtils.generateToken(user.getId(), user.getUsername(), primaryRole);

        LoginVO vo = new LoginVO();
        vo.setToken(token);
        vo.setUserId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setRealName(user.getRealName());
        vo.setAvatar(user.getAvatar());
        vo.setRoleCode(primaryRole);
        vo.setRoles(roleCodes);
        vo.setPermissions(permissions);
        vo.setMenus(menus);
        return vo;
    }

    public List<MenuVO> getUserMenus(Long userId) {
        return buildUserMenuTree(userId);
    }

    public List<SysRole> getAllRoles() {
        return roleMapper.selectList(new LambdaQueryWrapper<SysRole>()
                .eq(SysRole::getStatus, 1)
                .eq(SysRole::getIsDeleted, 0)
                .orderByAsc(SysRole::getSort));
    }

    private List<MenuVO> buildUserMenuTree(Long userId) {
        List<SysMenu> menus = isAdmin(userId) ? menuMapper.selectAllMenus() : menuMapper.selectMenusByUserId(userId);
        List<MenuVO> voList = menus.stream().map(m -> {
            MenuVO vo = new MenuVO();
            vo.setId(m.getId());
            vo.setParentId(m.getParentId());
            vo.setMenuName(m.getMenuName());
            vo.setMenuPath(m.getMenuPath());
            vo.setMenuIcon(m.getMenuIcon());
            vo.setComponent(m.getComponent());
            vo.setMenuType(m.getMenuType());
            vo.setSort(m.getSort());
            return vo;
        }).collect(Collectors.toList());

        Map<Long, List<MenuVO>> childrenMap = voList.stream()
                .collect(Collectors.groupingBy(MenuVO::getParentId));
        voList.forEach(vo -> vo.setChildren(childrenMap.getOrDefault(vo.getId(), Collections.emptyList())));
        return voList.stream().filter(v -> v.getParentId() == 0)
                .sorted(Comparator.comparing(MenuVO::getSort))
                .collect(Collectors.toList());
    }

    private boolean isAdmin(Long userId) {
        List<String> roles = userMapper.selectRoleCodesByUserId(userId);
        return roles.contains("ADMIN");
    }
}
