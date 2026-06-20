package com.mw.common.security;

public final class RoleConstants {

    private RoleConstants() {
    }

    /** 产废机构：医疗机构 */
    public static final String ROLE_PRODUCER = "ROLE_PRODUCER";
    /** 收运车队 */
    public static final String ROLE_TRANSPORTER = "ROLE_TRANSPORTER";
    /** 处置中心 */
    public static final String ROLE_DISPOSER = "ROLE_DISPOSER";
    /** 监管部门 */
    public static final String ROLE_REGULATOR = "ROLE_REGULATOR";
    /** 系统管理员 */
    public static final String ROLE_ADMIN = "ROLE_ADMIN";

    public static final String[] ALL_ROLES = {
            ROLE_PRODUCER, ROLE_TRANSPORTER, ROLE_DISPOSER, ROLE_REGULATOR, ROLE_ADMIN
    };
}
