package com.mw.common.security;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserInfo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String userId;
    private String username;
    private String realName;
    private String orgId;
    private String orgName;
    private Set<String> roles;
}
