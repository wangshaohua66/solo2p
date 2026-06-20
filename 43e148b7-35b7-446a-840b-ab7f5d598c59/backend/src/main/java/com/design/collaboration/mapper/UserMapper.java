package com.design.collaboration.mapper;

import com.design.collaboration.entity.User;
import com.design.collaboration.enums.ProfessionType;
import com.design.collaboration.enums.UserRole;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface UserMapper {

    @Select("SELECT * FROM sys_user WHERE id = #{id}")
    User findById(Long id);

    @Select("SELECT * FROM sys_user WHERE username = #{username}")
    User findByUsername(String username);

    @Select("SELECT * FROM sys_user ORDER BY id")
    List<User> findAll();

    @Select("SELECT * FROM sys_user WHERE role = #{role} ORDER BY id")
    List<User> findByRole(UserRole role);

    @Select("SELECT * FROM sys_user WHERE profession = #{profession} ORDER BY id")
    List<User> findByProfession(ProfessionType profession);

    @Insert("INSERT INTO sys_user(username, password, name, role, email, phone, profession) " +
            "VALUES(#{username}, #{password}, #{name}, #{role}, #{email}, #{phone}, #{profession})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(User user);

    @Update("UPDATE sys_user SET name=#{name}, role=#{role}, email=#{email}, phone=#{phone}, " +
            "profession=#{profession}, updated_at=CURRENT_TIMESTAMP WHERE id=#{id}")
    int update(User user);

    @Delete("DELETE FROM sys_user WHERE id=#{id}")
    int deleteById(Long id);
}
