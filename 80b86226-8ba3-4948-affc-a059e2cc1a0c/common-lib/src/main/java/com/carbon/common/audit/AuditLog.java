package com.carbon.common.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AuditLog {

    String operation();

    String module() default "";

    String resourceType() default "";

    boolean recordRequest() default true;

    boolean recordResponse() default false;

    String[] maskFields() default {"password", "token", "secret", "key"};
}
