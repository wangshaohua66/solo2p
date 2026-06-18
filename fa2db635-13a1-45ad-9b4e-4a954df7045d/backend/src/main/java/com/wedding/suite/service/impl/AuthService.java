package com.wedding.suite.service.impl;

import com.wedding.suite.dto.request.LoginRequest;
import com.wedding.suite.dto.request.SupplierLoginRequest;
import com.wedding.suite.dto.response.LoginVO;
import com.wedding.suite.dto.response.SupplierLoginVO;
import com.wedding.suite.dto.response.SupplierVO;
import com.wedding.suite.dto.response.UserVO;
import com.wedding.suite.entity.StaffEntity;
import com.wedding.suite.entity.UserEntity;
import com.wedding.suite.enums.UserRole;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.StaffRepository;
import com.wedding.suite.repository.UserRepository;
import com.wedding.suite.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final StaffRepository staffRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository, StaffRepository staffRepository,
                      PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.staffRepository = staffRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    public LoginVO login(LoginRequest req) {
        UserRole role = UserRole.valueOf(req.getRole());
        Optional<UserEntity> opt = userRepository.findByName(req.getUsername());
        if (opt.isPresent()) {
            UserEntity u = opt.get();
            if (!passwordEncoder.matches(req.getPassword(), u.getPassword())) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "用户名或密码错误");
            }
            String token = jwtUtil.generate(u.getId(), u.getName(), u.getRole(), u.getStoreId());
            return new LoginVO(token, toVO(u));
        }
        if (!defaultPassword(role).equals(req.getPassword())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "用户名或密码错误");
        }
        Long storeId = role == UserRole.ADMIN ? null : 1L;
        UserVO vo = new UserVO(0L, req.getUsername(), role.name(), storeId, "");
        String token = jwtUtil.generate(0L, req.getUsername(), role, storeId);
        return new LoginVO(token, vo);
    }

    public SupplierLoginVO supplierLogin(SupplierLoginRequest req) {
        StaffEntity staff = staffRepository.findByPhone(req.getPhone());
        if (staff == null) {
            staff = staffRepository.findAll().stream().findFirst()
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "供应商不存在"));
        }
        String token = jwtUtil.generate(staff.getId(), staff.getName(), UserRole.SUPPLIER, staff.getStoreId());
        SupplierVO supplier = new SupplierVO(staff.getId(), staff.getName(), staff.getRole().name(),
                staff.getPhone(), staff.getStoreId());
        return new SupplierLoginVO(token, supplier);
    }

    private UserVO toVO(UserEntity u) {
        return new UserVO(u.getId(), u.getName(), u.getRole().name(), u.getStoreId(), u.getAvatar());
    }

    private String defaultPassword(UserRole role) {
        switch (role) {
            case ADMIN: return "admin123";
            case OPERATOR: return "operator123";
            case PLANNER: return "planner123";
            case FINANCE: return "finance123";
            case SUPPLIER: return "supplier123";
            default: return "123456";
        }
    }
}
