package com.insurance.claim.entity;

import com.insurance.claim.enums.RoleType;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class User {

    private Long id;
    private String username;
    private String password;
    private String realName;
    private String idCard;
    private String phone;
    private String email;
    private String avatar;
    private RoleType role;
    private String department;
    private String branchCode;
    private String branchName;
    private String workArea;
    private BigDecimal workLongitude;
    private BigDecimal workLatitude;
    private Integer workRadius;
    private String employeeNo;
    private String qualificationNo;
    private Integer status;
    private Integer deleted;
    private LocalDateTime lastLoginTime;
    private String lastLoginIp;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private transient List<String> permissions;
}
