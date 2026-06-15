package com.ems.dispatch.controller

import com.ems.dispatch.dto.ApiResponse
import com.ems.dispatch.repository.UserRepository
import com.ems.dispatch.security.JwtService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/auth")
@Tag(name = "认证管理", description = "用户登录、Token刷新相关API")
class AuthController(
    private val authenticationManager: AuthenticationManager,
    private val userDetailsService: UserDetailsService,
    private val jwtService: JwtService,
    private val userRepository: UserRepository
) {
    data class LoginRequest(
        val username: String,
        val password: String
    )

    data class LoginResponse(
        val accessToken: String,
        val tokenType: String = "Bearer",
        val expiresIn: Int = 86400,
        val username: String,
        val realName: String,
        val role: String
    )

    @PostMapping("/login")
    @Operation(
        summary = "用户登录",
        description = "使用用户名和密码登录获取JWT Token"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "登录成功"),
        ApiResponse(responseCode = "401", description = "用户名或密码错误")
    )
    fun login(@Valid @RequestBody request: LoginRequest): ResponseEntity<ApiResponse<LoginResponse>> {
        val authentication = authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken(request.username, request.password)
        )

        val userDetails = userDetailsService.loadUserByUsername(request.username)
        val token = jwtService.generateToken(emptyMap(), userDetails)
        val user = userRepository.findByUsername(request.username)!!

        val response = LoginResponse(
            accessToken = token,
            username = user.username,
            realName = user.realName,
            role = user.role
        )

        return ResponseEntity.ok(ApiResponse.success(response, "登录成功"))
    }
}
