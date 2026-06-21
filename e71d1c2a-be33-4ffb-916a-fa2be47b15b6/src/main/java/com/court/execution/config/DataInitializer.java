package com.court.execution.config;

import com.court.execution.entity.*;
import com.court.execution.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final CoordinationUnitRepository unitRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository,
                           CoordinationUnitRepository unitRepository,
                           PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.unitRepository = unitRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        initUsers();
        initCoordinationUnits();
        logger.info("数据初始化完成");
    }

    private void initUsers() {
        if (userRepository.count() > 0) {
            logger.info("用户数据已存在，跳过初始化");
            return;
        }

        User admin = new User();
        admin.setUsername("admin");
        admin.setPassword(passwordEncoder.encode("admin123"));
        admin.setRealName("系统管理员");
        admin.setRole(UserRole.ADMIN);
        admin.setPhone("13800000000");
        admin.setEmail("admin@court.gov.cn");
        admin.setEnabled(true);
        userRepository.save(admin);
        logger.info("创建管理员用户: admin/admin123");

        User judge1 = new User();
        judge1.setUsername("judge01");
        judge1.setPassword(passwordEncoder.encode("judge123"));
        judge1.setRealName("张明法官");
        judge1.setRole(UserRole.JUDGE);
        judge1.setPhone("13800000001");
        judge1.setEnabled(true);
        userRepository.save(judge1);
        logger.info("创建法官用户: judge01/judge123");

        User judge2 = new User();
        judge2.setUsername("judge02");
        judge2.setPassword(passwordEncoder.encode("judge123"));
        judge2.setRealName("李华法官");
        judge2.setRole(UserRole.JUDGE);
        judge2.setPhone("13800000002");
        judge2.setEnabled(true);
        userRepository.save(judge2);
        logger.info("创建法官用户: judge02/judge123");

        User assistant1 = new User();
        assistant1.setUsername("assistant01");
        assistant1.setPassword(passwordEncoder.encode("assistant123"));
        assistant1.setRealName("王芳助理");
        assistant1.setRole(UserRole.ASSISTANT);
        assistant1.setPhone("13800000003");
        assistant1.setEnabled(true);
        userRepository.save(assistant1);
        logger.info("创建助理用户: assistant01/assistant123");

        User specialist1 = new User();
        specialist1.setUsername("auction01");
        specialist1.setPassword(passwordEncoder.encode("auction123"));
        specialist1.setRealName("赵强拍卖专员");
        specialist1.setRole(UserRole.AUCTION_SPECIALIST);
        specialist1.setPhone("13800000004");
        specialist1.setEnabled(true);
        userRepository.save(specialist1);
        logger.info("创建拍卖专员用户: auction01/auction123");
    }

    private void initCoordinationUnits() {
        if (unitRepository.count() > 0) {
            logger.info("协执单位数据已存在，跳过初始化");
            return;
        }

        CoordinationUnit bank1 = new CoordinationUnit();
        bank1.setUnitName("中国工商银行省分行");
        bank1.setPropertyType(PropertyType.BANK_DEPOSIT);
        bank1.setAddress("省会城市金融大街100号");
        bank1.setContactPerson("李经理");
        bank1.setContactPhone("010-88888801");
        bank1.setEmail("bank1@icbc.com");
        bank1.setEnabled(true);
        unitRepository.save(bank1);

        CoordinationUnit bank2 = new CoordinationUnit();
        bank2.setUnitName("中国建设银行省分行");
        bank2.setPropertyType(PropertyType.BANK_DEPOSIT);
        bank2.setAddress("省会城市金融大街200号");
        bank2.setContactPerson("王经理");
        bank2.setContactPhone("010-88888802");
        bank2.setEnabled(true);
        unitRepository.save(bank2);

        CoordinationUnit realEstate = new CoordinationUnit();
        realEstate.setUnitName("市不动产登记中心");
        realEstate.setPropertyType(PropertyType.REAL_ESTATE);
        realEstate.setAddress("市政务服务中心3楼");
        realEstate.setContactPerson("张主任");
        realEstate.setContactPhone("010-66666601");
        realEstate.setEnabled(true);
        unitRepository.save(realEstate);

        CoordinationUnit vehicle = new CoordinationUnit();
        vehicle.setUnitName("市公安局交通警察支队车辆管理所");
        vehicle.setPropertyType(PropertyType.VEHICLE);
        vehicle.setAddress("市南环路车管所");
        vehicle.setContactPerson("刘警官");
        vehicle.setContactPhone("010-77777701");
        vehicle.setEnabled(true);
        unitRepository.save(vehicle);

        CoordinationUnit stock = new CoordinationUnit();
        stock.setUnitName("中国证券登记结算有限责任公司");
        stock.setPropertyType(PropertyType.EQUITY);
        stock.setAddress("市金融中心大厦");
        stock.setContactPerson("陈经理");
        stock.setContactPhone("010-99999901");
        stock.setEnabled(true);
        unitRepository.save(stock);

        CoordinationUnit credit = new CoordinationUnit();
        credit.setUnitName("市公证处");
        credit.setPropertyType(PropertyType.CREDITOR_RIGHTS);
        credit.setAddress("市公证大厦");
        credit.setContactPerson("周公证员");
        credit.setContactPhone("010-55555501");
        credit.setEnabled(true);
        unitRepository.save(credit);

        logger.info("创建6个协执单位");
    }
}
