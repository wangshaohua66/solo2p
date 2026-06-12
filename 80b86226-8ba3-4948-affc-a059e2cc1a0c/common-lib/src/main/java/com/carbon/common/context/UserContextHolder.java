package com.carbon.common.context;

import com.carbon.common.exception.UnauthorizedException;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

public final class UserContextHolder {

    private static final ThreadLocal<CurrentUser> HOLDER = new InheritableThreadLocal<>();

    private UserContextHolder() {
    }

    public static void set(CurrentUser user) {
        HOLDER.set(user);
    }

    public static CurrentUser get() {
        CurrentUser user = HOLDER.get();
        if (user == null) {
            throw new UnauthorizedException("用户未登录");
        }
        return user;
    }

    public static CurrentUser getNullable() {
        return HOLDER.get();
    }

    public static String getTenantId() {
        return get().getTenantId();
    }

    public static String getTenantIdSafe() {
        CurrentUser u = HOLDER.get();
        return u == null ? null : u.getTenantId();
    }

    public static String getUserId() {
        return get().getUserId();
    }

    public static void clear() {
        HOLDER.remove();
    }

    public static boolean hasRole(String role) {
        CurrentUser u = HOLDER.get();
        return u != null && u.getRoles() != null && u.getRoles().contains(role);
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CurrentUser {
        private String userId;
        private String username;
        private String tenantId;
        private String tenantName;
        private String organizationId;
        private Set<String> roles;
        private Set<String> permissions;
        private Long issuedAt;
        private Long expiresAt;
    }
}
