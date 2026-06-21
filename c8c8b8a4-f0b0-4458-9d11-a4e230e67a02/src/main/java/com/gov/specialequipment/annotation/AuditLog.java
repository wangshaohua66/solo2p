package com.gov.specialequipment.annotation;

import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface AuditLog {

    String module() default "";

    String operationType() default "";

    String description() default "";
}
