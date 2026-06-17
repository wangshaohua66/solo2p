package com.heritage.auth.service.impl;

import com.heritage.auth.entity.User;
import com.heritage.auth.enums.RoleType;
import com.heritage.auth.repository.UserRepository;
import com.heritage.auth.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public User createUser(User user) {
        if (userRepository.existsByUsername(user.getUsername())) {
            throw new RuntimeException("用户名已存在");
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setEnabled(true);
        user.setAccountNonLocked(true);
        return userRepository.save(user);
    }

    @Override
    public User updateUser(String id, User user) {
        User existing = getUserById(id);
        if (user.getRealName() != null) existing.setRealName(user.getRealName());
        if (user.getEmail() != null) existing.setEmail(user.getEmail());
        if (user.getPhone() != null) existing.setPhone(user.getPhone());
        if (user.getAvatar() != null) existing.setAvatar(user.getAvatar());
        if (user.getRoles() != null) existing.setRoles(user.getRoles());
        if (user.getDepartment() != null) existing.setDepartment(user.getDepartment());
        if (user.getTitle() != null) existing.setTitle(user.getTitle());
        return userRepository.save(existing);
    }

    @Override
    public void deleteUser(String id) {
        userRepository.deleteById(id);
    }

    @Override
    public User getUserById(String id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("用户不存在"));
    }

    @Override
    public User getUserByUsername(String username) {
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new RuntimeException("用户不存在"));
    }

    @Override
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @Override
    public Page<User> getUsers(Pageable pageable) {
        return userRepository.findAll(pageable);
    }

    @Override
    public List<User> getUsersByRole(RoleType role) {
        return userRepository.findByRolesContaining(role);
    }

    @Override
    public List<User> getUsersByRoles(Set<RoleType> roles) {
        return userRepository.findByRolesIn(roles);
    }

    @Override
    public User updateUserStatus(String id, boolean enabled) {
        User user = getUserById(id);
        user.setEnabled(enabled);
        return userRepository.save(user);
    }

    @Override
    public User changePassword(String id, String oldPassword, String newPassword) {
        User user = getUserById(id);
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new RuntimeException("原密码错误");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        return userRepository.save(user);
    }

    @Override
    public User resetPassword(String id, String newPassword) {
        User user = getUserById(id);
        user.setPassword(passwordEncoder.encode(newPassword));
        return userRepository.save(user);
    }
}
