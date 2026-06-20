package com.mw.common.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 审计日志注解：标记需要记录审计日志的方法。
 * 切面会在方法执行成功后，记录操作人、操作时间、操作类型、变更前后数据。
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {

    AuditAction action();

    String module() default "";

    String description() default "";

    /** 是否记录方法返回值（变更后数据） */
    boolean recordResult() default true;
}
