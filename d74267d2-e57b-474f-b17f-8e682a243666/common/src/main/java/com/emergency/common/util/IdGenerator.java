package com.emergency.common.util;

import cn.hutool.core.util.IdUtil;

public class IdGenerator {

    public static Long nextId() {
        return IdUtil.getSnowflakeNextId();
    }

    public static String nextStringId() {
        return IdUtil.getSnowflakeNextIdStr();
    }

    public static String generateIncidentNo() {
        return "INC" + System.currentTimeMillis();
    }

    public static String generateDispatchNo() {
        return "DIS" + System.currentTimeMillis();
    }

    public static String generateInventoryNo() {
        return "INV" + System.currentTimeMillis();
    }

    public static String generateNotificationNo() {
        return "NOT" + System.currentTimeMillis();
    }
}
