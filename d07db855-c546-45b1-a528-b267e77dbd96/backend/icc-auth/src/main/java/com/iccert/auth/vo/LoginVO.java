package com.iccert.auth.vo;

import lombok.Data;
import java.util.List;

@Data
public class LoginVO {
    private String token;
    private Long userId;
    private String username;
    private String realName;
    private String avatar;
    private String roleCode;
    private List<String> roles;
    private List<String> permissions;
    private List<MenuVO> menus;
}
