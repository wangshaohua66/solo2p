package com.carbon.common.security;

import com.carbon.common.context.UserContextHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.ReactiveAuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.server.authorization.AuthorizationContext;
import reactor.core.publisher.Mono;

@Slf4j
@RequiredArgsConstructor
public class TenantReactiveAuthorizationManager
        implements ReactiveAuthorizationManager<AuthorizationContext> {

    @Override
    public Mono<AuthorizationDecision> check(Mono<Authentication> authentication,
                                              AuthorizationContext context) {
        return authentication
                .filter(Authentication::isAuthenticated)
                .map(auth -> {
                    UserContextHolder.CurrentUser user = (UserContextHolder.CurrentUser)
                            auth.getPrincipal();
                    boolean hasTenant = user != null && user.getTenantId() != null;
                    return new AuthorizationDecision(hasTenant);
                })
                .defaultIfEmpty(new AuthorizationDecision(false));
    }
}
