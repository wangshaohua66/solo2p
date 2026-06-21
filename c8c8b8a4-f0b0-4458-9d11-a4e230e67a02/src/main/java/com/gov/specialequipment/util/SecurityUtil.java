package com.gov.specialequipment.util;

import com.gov.specialequipment.entity.SysUser;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public class SecurityUtil {

    private SecurityUtil() {
    }

    public static SysUser getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof SysUser) {
            return (SysUser) principal;
        }
        return null;
    }

    public static Long getCurrentUserId() {
        SysUser user = getCurrentUser();
        return user != null ? user.getId() : null;
    }

    public static String getCurrentUsername() {
        SysUser user = getCurrentUser();
        return user != null ? user.getUsername() : null;
    }

    public static String getCurrentRoleCode() {
        SysUser user = getCurrentUser();
        return user != null ? user.getRoleCode() : null;
    }

    public static Long getCurrentOrganizationId() {
        SysUser user = getCurrentUser();
        return user != null ? user.getOrganizationId() : null;
    }

    public static String getCurrentRealName() {
        SysUser user = getCurrentUser();
        return user != null ? user.getRealName() : null;
    }
}
