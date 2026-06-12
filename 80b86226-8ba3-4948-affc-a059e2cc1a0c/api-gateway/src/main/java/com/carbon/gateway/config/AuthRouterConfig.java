package com.carbon.gateway.config;

import com.carbon.gateway.handler.AuthHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;

import static org.springframework.web.reactive.function.server.RequestPredicates.path;
import static org.springframework.web.reactive.function.server.RouterFunctions.route;

@Configuration
public class AuthRouterConfig {

    @Bean
    public RouterFunction<ServerResponse> authRoutes(AuthHandler handler) {
        return route()
                .path("/api/auth", b -> b
                        .POST("/login", handler::login)
                        .POST("/refresh", handler::refresh)
                        .GET("/me", handler::me)
                        .POST("/logout", handler::logout)
                )
                .build();
    }
}
