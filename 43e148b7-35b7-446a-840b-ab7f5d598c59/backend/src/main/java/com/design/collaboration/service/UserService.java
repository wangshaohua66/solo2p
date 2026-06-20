package com.design.collaboration.service;

import com.design.collaboration.dto.LoginRequest;
import com.design.collaboration.entity.User;
import com.design.collaboration.enums.ProfessionType;
import com.design.collaboration.enums.UserRole;
import com.design.collaboration.mapper.UserMapper;
import com.design.collaboration.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    public User login(LoginRequest request) {
        User user = userMapper.findByUsername(request.getUsername());
        if (user == null) {
            throw new RuntimeException("用户不存在");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("密码错误");
        }
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole().name());
        user.setToken(token);
        user.setPassword(null);
        return user;
    }

    public User findById(Long id) {
        return userMapper.findById(id);
    }

    public User findByUsername(String username) {
        return userMapper.findByUsername(username);
    }

    public List<User> findAll() {
        return userMapper.findAll();
    }

    public List<User> findByRole(UserRole role) {
        return userMapper.findByRole(role);
    }

    public List<User> findByProfession(ProfessionType profession) {
        return userMapper.findByProfession(profession);
    }

    public User create(User user) {
        if (user.getPassword() != null) {
            user.setPassword(passwordEncoder.encode(user.getPassword()));
        }
        userMapper.insert(user);
        return user;
    }

    public User update(User user) {
        userMapper.update(user);
        return userMapper.findById(user.getId());
    }

    public boolean delete(Long id) {
        return userMapper.deleteById(id) > 0;
    }
}
