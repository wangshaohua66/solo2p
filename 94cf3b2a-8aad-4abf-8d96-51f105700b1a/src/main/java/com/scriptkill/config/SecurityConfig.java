package com.scriptkill.config;

import com.scriptkill.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers(
                    "/swagger-ui/**",
                    "/swagger-ui.html",
                    "/swagger-ui/index.html",
                    "/api-docs/**",
                    "/v3/api-docs/**",
                    "/api-docs/swagger-config",
                    "/v3/api-docs/swagger-config"
                ).permitAll()
                .requestMatchers(
                    "/dark-theme.css",
                    "/favicon.ico",
                    "/favicon-*.png",
                    "/**/*.css",
                    "/**/*.js",
                    "/**/*.html",
                    "/**/*.png",
                    "/**/*.jpg",
                    "/**/*.jpeg",
                    "/**/*.svg",
                    "/**/*.ico",
                    "/**/*.woff2",
                    "/**/*.woff",
                    "/**/*.ttf"
                ).permitAll()
                .requestMatchers("/api/player/**").hasAnyRole("PLAYER", "DM", "STORE_MANAGER", "ADMIN")
                .requestMatchers("/api/dm/**").hasAnyRole("DM", "STORE_MANAGER", "ADMIN")
                .requestMatchers("/api/admin/**").hasAnyRole("STORE_MANAGER", "ADMIN")
                .requestMatchers("/api/session/**").hasAnyRole("PLAYER", "DM", "STORE_MANAGER", "ADMIN")
                .requestMatchers("/api/bookings/**").hasAnyRole("PLAYER", "DM", "STORE_MANAGER", "ADMIN")
                .requestMatchers("/api/reviews/**").hasAnyRole("PLAYER", "DM", "STORE_MANAGER", "ADMIN")
                .requestMatchers("/api/clues/session/*/subscribe").authenticated()
                .requestMatchers("/api/clues/**").hasAnyRole("DM", "STORE_MANAGER", "ADMIN")
                .requestMatchers("/api/dm/schedules/**").hasAnyRole("DM", "STORE_MANAGER", "ADMIN")
                .requestMatchers("/api/purchases/**").hasAnyRole("STORE_MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/scripts/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/scripts/**").hasAnyRole("STORE_MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/scripts/**").hasAnyRole("STORE_MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/scripts/**").hasAnyRole("STORE_MANAGER", "ADMIN")
                .requestMatchers("/sse/**").hasAnyRole("PLAYER", "DM", "STORE_MANAGER", "ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(Arrays.asList("Authorization", "Content-Disposition"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }
}
