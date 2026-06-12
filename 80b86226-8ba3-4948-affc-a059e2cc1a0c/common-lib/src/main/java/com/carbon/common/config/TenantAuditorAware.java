package com.carbon.common.config;

import com.carbon.common.context.UserContextHolder;
import org.springframework.data.domain.AuditorAware;

import java.util.Optional;

public class TenantAuditorAware implements AuditorAware<String> {

    @Override
    public Optional<String> getCurrentAuditor() {
        UserContextHolder.CurrentUser u = UserContextHolder.getNullable();
        if (u == null) return Optional.of("system");
        return Optional.ofNullable(u.getUserId());
    }
}
