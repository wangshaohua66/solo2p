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
import io.jsonwebtoken.Claims;
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
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
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
    @ConditionalOnClass(name = "org.springframework.security.web.SecurityFilterChain")
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
                .addFilterBefore(new JwtAuthHeaderForwardFilter(jwtTokenProvider),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Slf4j
    @RequiredArgsConstructor
    public static class JwtAuthHeaderForwardFilter extends OncePerRequestFilter {

        private final JwtTokenProvider jwtTokenProvider;

        @Override
        protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                throws ServletException, IOException {
            try {
                String authoritiesHeader = req.getHeader("X-JWT-Authorities");
                String tenantId = req.getHeader("X-Tenant-Id");
                String userId = req.getHeader("X-User-Id");
                String username = null;
                List<SimpleGrantedAuthority> authorities = Collections.emptyList();

                if (authoritiesHeader != null && !authoritiesHeader.isBlank()) {
                    authorities = Arrays.stream(authoritiesHeader.split(","))
                            .map(String::trim)
                            .filter(s -> !s.isEmpty())
                            .map(s -> s.startsWith("ROLE_") ? s : "ROLE_" + s)
                            .map(SimpleGrantedAuthority::new)
                            .collect(Collectors.toList());
                } else {
                    String bearer = req.getHeader("Authorization");
                    if (bearer != null && bearer.startsWith("Bearer ")) {
                        try {
                            Claims claims = jwtTokenProvider.parseToken(bearer.substring(7));
                            username = claims.getSubject();
                            Object auths = claims.get("authorities");
                            if (auths instanceof List<?> list) {
                                authorities = list.stream()
                                        .map(Object::toString)
                                        .map(s -> s.startsWith("ROLE_") ? s : "ROLE_" + s)
                                        .map(SimpleGrantedAuthority::new)
                                        .collect(Collectors.toList());
                            }
                        } catch (Exception e) {
                            log.debug("Parse JWT failed: {}", e.getMessage());
                        }
                    }
                }

                if (tenantId != null || userId != null || !authorities.isEmpty()) {
                    Object principal = username != null ? username
                            : (userId != null ? userId : "anonymous");
                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(principal, null, authorities);
                    auth.setDetails(new UserContextHolder.CurrentUser(
                            userId, username, tenantId,
                            authorities.stream().map(a -> a.getAuthority().replace("ROLE_", ""))
                                    .collect(Collectors.toList()),
                            null));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception e) {
                log.warn("JwtAuthHeaderForwardFilter error: {}", e.getMessage());
            }
            chain.doFilter(req, res);
        }
    }
}
