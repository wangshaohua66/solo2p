package com.heritage.auth.service;

import com.heritage.auth.entity.User;
import com.heritage.auth.enums.RoleType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Set;

public interface UserService {

    User createUser(User user);

    User updateUser(String id, User user);

    void deleteUser(String id);

    User getUserById(String id);

    User getUserByUsername(String username);

    List<User> getAllUsers();

    Page<User> getUsers(Pageable pageable);

    List<User> getUsersByRole(RoleType role);

    List<User> getUsersByRoles(Set<RoleType> roles);

    User updateUserStatus(String id, boolean enabled);

    User changePassword(String id, String oldPassword, String newPassword);

    User resetPassword(String id, String newPassword);
}
