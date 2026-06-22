package com.heritage.service;

import com.heritage.common.ApiResponse;
import com.heritage.entity.Notification;
import com.heritage.entity.User;
import com.heritage.enums.UserRole;
import com.heritage.repository.NotificationRepository;
import com.heritage.repository.UserRepository;
import com.heritage.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JwtTokenProvider tokenProvider;

    public ApiResponse<Map<String, Object>> login(String username, String password) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username, password)
            );

            String token = tokenProvider.generateToken(authentication);

            User user = userRepository.findByUsername(username).orElse(null);

            Map<String, Object> result = new HashMap<>();
            result.put("token", token);
            result.put("user", user);

            return ApiResponse.success("登录成功", result);
        } catch (Exception e) {
            return ApiResponse.error(401, "用户名或密码错误");
        }
    }

    @Transactional
    public ApiResponse<User> register(User user) {
        if (userRepository.existsByUsername(user.getUsername())) {
            return ApiResponse.error(400, "用户名已存在");
        }

        if (userRepository.existsByEmail(user.getEmail())) {
            return ApiResponse.error(400, "邮箱已注册");
        }

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setEnabled(true);
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            user.setRoles(Set.of(UserRole.PUBLIC));
        }

        User saved = userRepository.save(user);
        return ApiResponse.success("注册成功", saved);
    }

    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public Optional<User> findById(String id) {
        return userRepository.findById(id);
    }

    public Page<User> getAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable);
    }

    public Page<Notification> getNotifications(String userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    public long getUnreadNotificationCount(String userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    @Transactional
    public void markNotificationAsRead(String notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
    }

    @Transactional
    public void markAllNotificationsAsRead(String userId) {
        Page<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(
                userId, Pageable.unpaged());
        notifications.getContent().forEach(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
    }

    public User updateUser(String id, User user) {
        User existing = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        existing.setRealName(user.getRealName());
        existing.setPhone(user.getPhone());
        existing.setEmail(user.getEmail());
        existing.setAvatar(user.getAvatar());
        existing.setOrganization(user.getOrganization());

        return userRepository.save(existing);
    }
}
