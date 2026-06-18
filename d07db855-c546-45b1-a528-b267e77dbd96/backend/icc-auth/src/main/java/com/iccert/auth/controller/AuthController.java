package com.iccert.auth.controller;

import com.iccert.auth.dto.LoginDTO;
import com.iccert.auth.entity.SysRole;
import com.iccert.auth.service.AuthService;
import com.iccert.auth.vo.LoginVO;
import com.iccert.auth.vo.MenuVO;
import com.iccert.common.result.R;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "认证授权", description = "用户登录、菜单权限、角色管理")
@RestController
@RequestMapping
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "用户登录", description = "用户名密码登录,返回Token及用户菜单")
    @PostMapping("/login")
    public R<LoginVO> login(@Valid @RequestBody LoginDTO dto) {
        return R.ok(authService.login(dto));
    }

    @Operation(summary = "获取当前用户菜单", description = "根据登录用户动态返回菜单树")
    @GetMapping("/menus")
    public R<List<MenuVO>> getUserMenus(HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        return R.ok(authService.getUserMenus(userId));
    }

    @Operation(summary = "获取所有角色")
    @GetMapping("/roles")
    public R<List<SysRole>> getAllRoles() {
        return R.ok(authService.getAllRoles());
    }

    @Operation(summary = "获取当前用户信息")
    @GetMapping("/info")
    public R<LoginVO> getUserInfo(HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        LoginVO vo = new LoginVO();
        vo.setUserId(userId);
        vo.setUsername(request.getHeader("X-Username"));
        vo.setRoleCode(request.getHeader("X-Role-Code"));
        vo.setMenus(authService.getUserMenus(userId));
        return R.ok(vo);
    }
}
