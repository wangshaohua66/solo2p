package com.wedding.suite.common;

import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class AuthUtil {

    private AuthUtil() {}

    public static SecurityUser current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof SecurityUser)) {
            return null;
        }
        return (SecurityUser) auth.getPrincipal();
    }

    public static SecurityUser require() {
        SecurityUser u = current();
        if (u == null) throw new BusinessException(ErrorCode.UNAUTHORIZED);
        return u;
    }

    public static Long currentUserId() {
        SecurityUser u = current();
        return u == null ? null : u.getId();
    }

    public static boolean isSupplier() {
        SecurityUser u = current();
        return u != null && u.getRole() != null && u.getRole().name().equals("SUPPLIER");
    }
}
