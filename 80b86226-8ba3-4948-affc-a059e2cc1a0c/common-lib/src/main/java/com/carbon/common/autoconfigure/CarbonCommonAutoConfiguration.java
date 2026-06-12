package com.carbon.common.autoconfigure;

import com.carbon.common.audit.AuditLogAspect;
import com.carbon.common.config.CacheConfig;
import com.carbon.common.config.OpenApiConfig;
import com.carbon.common.config.TenantAuditorAware;
import com.carbon.common.config.TenantRoutingMongoDatabaseFactory;
import com.carbon.common.config.TenantTransactionAspect;
import com.carbon.common.context.UserContextHolder;
import com.carbon.common.exception.GlobalExceptionHandler;
import com.carbon.common.integration.WebhookNotifier;
import com.carbon.common.security.JwtTokenProvider;
import com.mongodb.client.MongoClient;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Configuration
@Import({
        CacheConfig.class,
        OpenApiConfig.class,
        GlobalExceptionHandler.class,
        AuditLogAspect.class,
        TenantTransactionAspect.class,
        JwtTokenProvider.class,
        WebhookNotifier.class
})
@EnableMongoAuditing
@EnableAsync
@EnableMethodSecurity
public class CarbonCommonAutoConfiguration {

    private static final String HEADER_AUTHORITIES = "X-JWT-Authorities";
    private static final String HEADER_TENANT_ID = "X-Tenant-Id";
    private static final String HEADER_USER_ID = "X-User-Id";
    private static final String HEADER_TENANT_NAME = "X-Tenant-Name";

    @Bean
    @ConditionalOnMissingBean
    public AuditorAware<String> auditorProvider() {
        return new TenantAuditorAware();
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnClass(MongoClient.class)
    public MongoDatabaseFactory mongoDatabaseFactory(
            MongoClient mongoClient,
            @Value("${spring.data.mongodb.database:carbon}") String database,
            @Value("${carbon.mongo.tenant-prefix:carbon_}") String tenantPrefix) {
        return new TenantRoutingMongoDatabaseFactory(mongoClient, database, tenantPrefix);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnClass(name = "org.springframework.data.mongodb.core.MongoTemplate")
    public MongoTemplate mongoTemplate(MongoDatabaseFactory factory) {
        return new MongoTemplate(factory);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnClass(name = "org.springframework.transaction.PlatformTransactionManager")
    public PlatformTransactionManager mongoTransactionManager(MongoDatabaseFactory factory) {
        return new MongoTransactionManager(factory);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public SecurityFilterChain mvcSecurityFilterChain(
            HttpSecurity http, JwtTokenProvider jwtTokenProvider) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/actuator/**",
                                "/swagger-ui/**",
                                "/v3/api-docs/**",
                                "/swagger-resources/**",
                                "/error",
                                "/api/auth/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(new JwtAuthHeaderForwardFilter(),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Slf4j
    public static class JwtAuthHeaderForwardFilter extends OncePerRequestFilter {

        @Override
        protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                throws ServletException, IOException {
            String path = req.getRequestURI();
            boolean permitAll = path.startsWith("/actuator")
                    || path.startsWith("/swagger-ui")
                    || path.startsWith("/v3/api-docs")
                    || path.startsWith("/swagger-resources")
                    || path.startsWith("/api/auth")
                    || path.equals("/error");

            if (permitAll) {
                chain.doFilter(req, res);
                return;
            }

            String tenantId = req.getHeader(HEADER_TENANT_ID);
            String userId = req.getHeader(HEADER_USER_ID);
            String tenantName = req.getHeader(HEADER_TENANT_NAME);
            String authoritiesHeader = req.getHeader(HEADER_AUTHORITIES);

            boolean hasTenant = tenantId != null && !tenantId.isBlank();
            boolean hasUser = userId != null && !userId.isBlank();

            if (!hasTenant || !hasUser) {
                log.warn("Missing required headers: X-Tenant-Id={}, X-User-Id={}, uri={}",
                        tenantId, userId, path);
                sendUnauthorized(res, "Missing tenant/user identity headers");
                return;
            }

            Set<String> roleSet = new HashSet<>();
            if (authoritiesHeader != null && !authoritiesHeader.isBlank()) {
                List<String> list = Arrays.stream(authoritiesHeader.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .collect(Collectors.toList());
                roleSet.addAll(list);
            }

            UserContextHolder.CurrentUser currentUser = UserContextHolder.CurrentUser.builder()
                    .userId(userId)
                    .tenantId(tenantId)
                    .tenantName(tenantName)
                    .roles(roleSet)
                    .permissions(new HashSet<>())
                    .build();
            UserContextHolder.set(currentUser);

            List<SimpleGrantedAuthority> authorities = roleSet.stream()
                    .map(s -> s.startsWith("ROLE_") ? s : "ROLE_" + s)
                    .map(SimpleGrantedAuthority::new)
                    .collect(Collectors.toList());

            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(userId, null, authorities);
            auth.setDetails(currentUser);
            SecurityContextHolder.getContext().setAuthentication(auth);

            try {
                chain.doFilter(req, res);
            } finally {
                UserContextHolder.clear();
                SecurityContextHolder.clearContext();
            }
        }

        private void sendUnauthorized(HttpServletResponse res, String msg) throws IOException {
            res.setStatus(HttpStatus.UNAUTHORIZED.value());
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"code\":401,\"message\":\"" + msg + "\"}");
        }
    }
}
