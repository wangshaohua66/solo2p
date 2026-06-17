package com.heritage.auth.config;

import com.heritage.auth.entity.User;
import com.heritage.auth.enums.RoleType;
import com.heritage.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (!userRepository.existsByUsername("admin")) {
            User admin = User.builder()
                .username("admin")
                .password(passwordEncoder.encode("admin123"))
                .realName("系统管理员")
                .email("admin@heritage.gov.cn")
                .phone("13800000001")
                .roles(Set.of(RoleType.ADMIN))
                .department("信息中心")
                .title("高级工程师")
                .dataAccessLevel(5)
                .enabled(true)
                .accountNonLocked(true)
                .build();
            userRepository.save(admin);
            log.info("默认管理员账户创建成功: admin/admin123");
        }

        if (!userRepository.existsByUsername("expert")) {
            User expert = User.builder()
                .username("expert")
                .password(passwordEncoder.encode("expert123"))
                .realName("张专家")
                .email("expert@heritage.gov.cn")
                .phone("13800000002")
                .roles(Set.of(RoleType.EXPERT))
                .department("文物鉴定中心")
                .title("研究员")
                .dataAccessLevel(4)
                .enabled(true)
                .accountNonLocked(true)
                .build();
            userRepository.save(expert);
            log.info("默认专家账户创建成功: expert/expert123");
        }

        if (!userRepository.existsByUsername("restorer")) {
            User restorer = User.builder()
                .username("restorer")
                .password(passwordEncoder.encode("restorer123"))
                .realName("李修复师")
                .email("restorer@heritage.gov.cn")
                .phone("13800000003")
                .roles(Set.of(RoleType.RESTORER))
                .department("文物修复中心")
                .title("高级修复师")
                .dataAccessLevel(3)
                .enabled(true)
                .accountNonLocked(true)
                .build();
            userRepository.save(restorer);
            log.info("默认修复师账户创建成功: restorer/restorer123");
        }

        if (!userRepository.existsByUsername("archivist")) {
            User archivist = User.builder()
                .username("archivist")
                .password(passwordEncoder.encode("archivist123"))
                .realName("王档案员")
                .email("archivist@heritage.gov.cn")
                .phone("13800000004")
                .roles(Set.of(RoleType.ARCHIVIST))
                .department("档案管理科")
                .title("馆员")
                .dataAccessLevel(2)
                .enabled(true)
                .accountNonLocked(true)
                .build();
            userRepository.save(archivist);
            log.info("默认档案员账户创建成功: archivist/archivist123");
        }

        if (!userRepository.existsByUsername("inspector")) {
            User inspector = User.builder()
                .username("inspector")
                .password(passwordEncoder.encode("inspector123"))
                .realName("赵巡查员")
                .email("inspector@heritage.gov.cn")
                .phone("13800000005")
                .roles(Set.of(RoleType.INSPECTOR))
                .department("巡查执法科")
                .title("巡查员")
                .dataAccessLevel(1)
                .enabled(true)
                .accountNonLocked(true)
                .build();
            userRepository.save(inspector);
            log.info("默认巡查员账户创建成功: inspector/inspector123");
        }
    }
}
