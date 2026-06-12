package com.carbon.common.api;

import cn.hutool.core.util.IdUtil;

public final class TraceIdHolder {

    private static final ThreadLocal<String> HOLDER = new InheritableThreadLocal<>();

    private TraceIdHolder() {
    }

    public static String get() {
        String traceId = HOLDER.get();
        if (traceId == null) {
            traceId = IdUtil.fastSimpleUUID();
            HOLDER.set(traceId);
        }
        return traceId;
    }

    public static void set(String traceId) {
        HOLDER.set(traceId);
    }

    public static void clear() {
        HOLDER.remove();
    }
}
