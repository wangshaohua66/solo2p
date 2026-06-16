package com.emergency.common.util;

import com.emergency.common.dto.LoginUser;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public class SecurityUtils {

    public static LoginUser getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof LoginUser) {
            return (LoginUser) authentication.getPrincipal();
        }
        return null;
    }

    public static Long getCurrentUserId() {
        LoginUser user = getCurrentUser();
        return user != null ? user.getUserId() : null;
    }

    public static Long getCurrentOrganizationId() {
        LoginUser user = getCurrentUser();
        return user != null ? user.getOrganizationId() : null;
    }

    public static String getCurrentRegionCode() {
        LoginUser user = getCurrentUser();
        return user != null ? user.getRegionCode() : null;
    }

    public static Integer getCurrentOrganizationLevel() {
        LoginUser user = getCurrentUser();
        return user != null ? user.getOrganizationLevel() : null;
    }

    public static boolean hasRole(String role) {
        LoginUser user = getCurrentUser();
        return user != null && user.getRoles() != null && user.getRoles().contains(role);
    }

    public static boolean hasPermission(String permission) {
        LoginUser user = getCurrentUser();
        return user != null && user.getPermissions() != null && user.getPermissions().contains(permission);
    }
}
