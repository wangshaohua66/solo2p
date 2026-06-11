package com.glassstudio.config;

import com.glassstudio.entity.*;
import com.glassstudio.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Component
@Profile("dev")
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final KilnRepository kilnRepository;
    private final MemberRepository memberRepository;
    private final FiringCurveRepository firingCurveRepository;
    private final ScheduleRepository scheduleRepository;
    private final MemberRoleConfigRepository memberRoleConfigRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        initKilns();
        initMemberRoleConfigs();
        initAdminUser();
        initSampleMembers();
        initSampleCurves();
        initSampleSchedules();
    }

    private void initKilns() {
        if (kilnRepository.count() > 0) {
            return;
        }

        Kiln kiln1 = Kiln.builder()
                .name("实验窑1号")
                .type(KilnType.EXPERIMENTAL)
                .maxCapacity(50)
                .totalFiringCount(120)
                .heatingElementImpedance(new BigDecimal("12.5"))
                .healthStatus(HealthStatus.HEALTHY)
                .lastMaintenanceDate(LocalDateTime.now().minusMonths(2))
                .build();

        Kiln kiln2 = Kiln.builder()
                .name("工作窑1号")
                .type(KilnType.WORKING)
                .maxCapacity(100)
                .totalFiringCount(350)
                .heatingElementImpedance(new BigDecimal("18.2"))
                .healthStatus(HealthStatus.WARNING)
                .lastMaintenanceDate(LocalDateTime.now().minusMonths(5))
                .build();

        Kiln kiln3 = Kiln.builder()
                .name("退火窑1号")
                .type(KilnType.ANNEALING)
                .maxCapacity(80)
                .totalFiringCount(80)
                .heatingElementImpedance(new BigDecimal("10.8"))
                .healthStatus(HealthStatus.HEALTHY)
                .lastMaintenanceDate(LocalDateTime.now().minusMonths(1))
                .build();

        kilnRepository.save(kiln1);
        kilnRepository.save(kiln2);
        kilnRepository.save(kiln3);
    }

    private void initMemberRoleConfigs() {
        if (memberRoleConfigRepository.count() > 0) {
            return;
        }

        MemberRoleConfig studentConfig = MemberRoleConfig.builder()
                .role(MemberRole.STUDENT)
                .allowedKilnTypes("EXPERIMENTAL")
                .maxAdvanceDays(7)
                .maxDurationHours(4)
                .build();

        MemberRoleConfig regularConfig = MemberRoleConfig.builder()
                .role(MemberRole.REGULAR)
                .allowedKilnTypes("EXPERIMENTAL,WORKING,ANNEALING")
                .maxAdvanceDays(30)
                .maxDurationHours(12)
                .build();

        MemberRoleConfig professionalConfig = MemberRoleConfig.builder()
                .role(MemberRole.PROFESSIONAL)
                .allowedKilnTypes("EXPERIMENTAL,WORKING,ANNEALING")
                .maxAdvanceDays(60)
                .maxDurationHours(24)
                .build();

        MemberRoleConfig adminConfig = MemberRoleConfig.builder()
                .role(MemberRole.ADMIN)
                .allowedKilnTypes("EXPERIMENTAL,WORKING,ANNEALING")
                .maxAdvanceDays(365)
                .maxDurationHours(72)
                .build();

        memberRoleConfigRepository.save(studentConfig);
        memberRoleConfigRepository.save(regularConfig);
        memberRoleConfigRepository.save(professionalConfig);
        memberRoleConfigRepository.save(adminConfig);
    }

    private void initAdminUser() {
        if (memberRepository.existsByUsername("admin")) {
            return;
        }

        Member admin = Member.builder()
                .username("admin")
                .passwordHash(passwordEncoder.encode("admin123"))
                .realName("系统管理员")
                .email("admin@glassstudio.com")
                .phone("13800138000")
                .role(MemberRole.ADMIN)
                .status(MemberStatus.ACTIVE)
                .build();

        memberRepository.save(admin);
    }

    private void initSampleMembers() {
        if (memberRepository.count() > 1) {
            return;
        }

        Member member1 = Member.builder()
                .username("zhangsan")
                .passwordHash(passwordEncoder.encode("123456"))
                .realName("张三")
                .email("zhangsan@example.com")
                .phone("13800138001")
                .role(MemberRole.PROFESSIONAL)
                .status(MemberStatus.ACTIVE)
                .build();

        Member member2 = Member.builder()
                .username("lisi")
                .passwordHash(passwordEncoder.encode("123456"))
                .realName("李四")
                .email("lisi@example.com")
                .phone("13800138002")
                .role(MemberRole.REGULAR)
                .status(MemberStatus.ACTIVE)
                .build();

        Member member3 = Member.builder()
                .username("wangwu")
                .passwordHash(passwordEncoder.encode("123456"))
                .realName("王五")
                .email("wangwu@example.com")
                .phone("13800138003")
                .role(MemberRole.STUDENT)
                .status(MemberStatus.ACTIVE)
                .build();

        memberRepository.save(member1);
        memberRepository.save(member2);
        memberRepository.save(member3);
    }

    private void initSampleCurves() {
        if (firingCurveRepository.count() > 0) {
            return;
        }

        FiringCurve curve1 = FiringCurve.builder()
                .name("标准玻璃熔制曲线")
                .segments(java.util.Arrays.asList(
                        CurveSegment.builder().targetTemp(300).duration(60).description("升温段1").build(),
                        CurveSegment.builder().targetTemp(800).duration(120).description("升温段2").build(),
                        CurveSegment.builder().targetTemp(1200).duration(180).description("高温保温").build(),
                        CurveSegment.builder().targetTemp(500).duration(100).description("降温段").build(),
                        CurveSegment.builder().targetTemp(450).duration(120).description("退火保温").build()
                ))
                .isTemplate(true)
                .createdBy(1L)
                .build();

        FiringCurve curve2 = FiringCurve.builder()
                .name("低温烧结曲线")
                .segments(java.util.Arrays.asList(
                        CurveSegment.builder().targetTemp(400).duration(40).description("升温段").build(),
                        CurveSegment.builder().targetTemp(800).duration(80).description("升温段2").build(),
                        CurveSegment.builder().targetTemp(800).duration(120).description("保温段").build()
                ))
                .isTemplate(true)
                .createdBy(1L)
                .build();

        FiringCurve curve3 = FiringCurve.builder()
                .name("快速退火曲线")
                .segments(java.util.Arrays.asList(
                        CurveSegment.builder().targetTemp(550).duration(30).description("快速降温").build(),
                        CurveSegment.builder().targetTemp(550).duration(60).description("保温退火").build(),
                        CurveSegment.builder().targetTemp(300).duration(90).description("缓慢冷却").build()
                ))
                .isTemplate(true)
                .createdBy(1L)
                .build();

        firingCurveRepository.save(curve1);
        firingCurveRepository.save(curve2);
        firingCurveRepository.save(curve3);
    }

    private void initSampleSchedules() {
        if (scheduleRepository.count() > 0) {
            return;
        }

        Schedule schedule1 = Schedule.builder()
                .kilnId(1L)
                .memberId(2L)
                .curveId(1L)
                .startTime(LocalDateTime.now().plusDays(1).withHour(9).withMinute(0))
                .endTime(LocalDateTime.now().plusDays(1).withHour(15).withMinute(0))
                .status(ScheduleStatus.PENDING)
                .workpieceCount(20)
                .note("艺术玻璃烧制")
                .build();

        Schedule schedule2 = Schedule.builder()
                .kilnId(2L)
                .memberId(3L)
                .curveId(2L)
                .startTime(LocalDateTime.now().plusDays(2).withHour(10).withMinute(0))
                .endTime(LocalDateTime.now().plusDays(2).withHour(16).withMinute(0))
                .status(ScheduleStatus.PENDING)
                .workpieceCount(50)
                .note("批量生产")
                .build();

        scheduleRepository.save(schedule1);
        scheduleRepository.save(schedule2);
    }
}
