package com.gov.specialequipment.vo;

import lombok.Data;

@Data
public class LoginVO {

    private String token;
    private String tokenType;
    private Long expiresIn;
    private Long userId;
    private String username;
    private String realName;
    private String roleCode;
    private String roleName;
    private Long organizationId;
    private String organizationName;
}
