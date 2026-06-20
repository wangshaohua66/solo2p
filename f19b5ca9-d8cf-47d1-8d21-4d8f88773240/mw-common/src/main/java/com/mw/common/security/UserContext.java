package com.mw.common.security;

public final class UserContext {

    private static final ThreadLocal<UserInfo> HOLDER = new ThreadLocal<>();

    private UserContext() {
    }

    public static void set(UserInfo user) {
        HOLDER.set(user);
    }

    public static UserInfo get() {
        return HOLDER.get();
    }

    public static String currentUserId() {
        UserInfo u = HOLDER.get();
        return u == null ? "system" : u.getUserId();
    }

    public static String currentUsername() {
        UserInfo u = HOLDER.get();
        return u == null ? "system" : u.getUsername();
    }

    public static void clear() {
        HOLDER.remove();
    }
}
