package com.insurance.claim.mapper;

import com.insurance.claim.entity.User;
import com.insurance.claim.enums.RoleType;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.math.BigDecimal;
import java.util.List;

@Mapper
public interface UserMapper {

    User selectById(@Param("id") Long id);

    User selectByUsername(@Param("username") String username);

    User selectByPhone(@Param("phone") String phone);

    List<User> selectByRole(@Param("role") RoleType role);

    List<User> selectAvailableSurveyors(@Param("longitude") BigDecimal longitude,
                                        @Param("latitude") BigDecimal latitude,
                                        @Param("radius") Integer radius);

    int updateLastLogin(@Param("id") Long id,
                        @Param("lastLoginTime") java.time.LocalDateTime lastLoginTime,
                        @Param("lastLoginIp") String lastLoginIp);

    int insert(User user);

    int updateById(User user);

    int updateStatus(@Param("id") Long id, @Param("status") Integer status);
}
