package com.heritage.restoration;

import com.heritage.restoration.dto.ProjectCreateDTO;
import com.heritage.restoration.dto.ProjectSearchDTO;
import com.heritage.restoration.entity.RestorationProject;
import com.heritage.restoration.enums.ProjectStatus;
import com.heritage.restoration.enums.RepairType;
import com.heritage.restoration.repository.ProjectRepository;
import com.heritage.restoration.service.RestorationService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(classes = RestorationServiceApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Rollback
class RestorationProjectTests {

    @Autowired private RestorationService restorationService;
    @Autowired private ProjectRepository projectRepository;

    private static String PROJECT_ID;

    @Test
    @Order(1)
    @Transactional
    void test1_createProject() {
        ProjectCreateDTO dto = ProjectCreateDTO.builder()
            .artifactId("art_test_001")
            .name("JUnit测试-青铜鼎修复")
            .description("单位测试创建的修复项目")
            .supervisorId("u_admin")
            .supervisorName("测试管理员")
            .restorerIds(List.of("u_r1", "u_r2"))
            .repairTypes(Arrays.asList(RepairType.CLEANING, RepairType.REINFORCEMENT, RepairType.REPAIR))
            .budget(new BigDecimal("12500.00"))
            .plannedStartTime(LocalDateTime.now())
            .plannedEndTime(LocalDateTime.now().plusDays(30))
            .build();
        RestorationProject p = restorationService.create(dto, "u_admin", "测试管理员");
        assertNotNull(p.getId());
        assertEquals(ProjectStatus.DRAFT, p.getStatus());
        assertEquals("青铜鼎修复", p.getName().substring(p.getName().length()-5));
        assertTrue(p.getProjectCode().startsWith("RS"));
        assertNotNull(p.getBudget());
        PROJECT_ID = p.getId();
        System.out.println("[OK] test1_createProject 项目ID: " + PROJECT_ID);
    }

    @Test
    @Order(2)
    @Transactional
    void test2_searchProjects() {
        ProjectSearchDTO dto = new ProjectSearchDTO();
        dto.setKeyword("JUnit");
        dto.setStatus(ProjectStatus.DRAFT);
        dto.setPage(0); dto.setSize(10);
        dto.setSortBy("createdAt"); dto.setSortDir("DESC");
        Page<RestorationProject> page = restorationService.search(dto);
        assertTrue(page.getTotalElements() >= 1);
        System.out.println("[OK] test2_searchProjects hits=" + page.getTotalElements());
    }

    @Test
    @Order(3)
    @Transactional
    void test3_statusTransition() {
        RestorationProject p = projectRepository.findById(PROJECT_ID).orElseThrow();
        assertEquals(ProjectStatus.DRAFT, p.getStatus());
        RestorationProject r = restorationService.updateStatus(PROJECT_ID, ProjectStatus.APPROVING, "提交审批", "u_admin", "测试管理员");
        assertEquals(ProjectStatus.APPROVING, r.getStatus());
        RestorationProject r2 = restorationService.updateStatus(PROJECT_ID, ProjectStatus.IN_PROGRESS, "开始修复", "u_admin", "测试管理员");
        assertEquals(ProjectStatus.IN_PROGRESS, r2.getStatus());
        assertNotNull(r2.getActualStartTime());
        RestorationProject r3 = restorationService.updateStatus(PROJECT_ID, ProjectStatus.COMPLETED, "修复完成", "u_admin", "测试管理员");
        assertEquals(100, r3.getProgress());
        assertEquals(ProjectStatus.COMPLETED, r3.getStatus());
        System.out.println("[OK] test3_statusTransition DRAFT→APPROVING→IN_PROGRESS→COMPLETED 成功");
    }

    @Test
    @Order(4)
    @Transactional
    void test4_progressUpdate() {
        restorationService.updateStatus(PROJECT_ID, ProjectStatus.IN_PROGRESS, "重开测试", "u_admin", "测试管理员");
        restorationService.updateProgress(PROJECT_ID, 75, "已完成器身补色", "u_r1", "修复师A");
        RestorationProject p = projectRepository.findById(PROJECT_ID).orElseThrow();
        assertEquals(75, p.getProgress());
        assertEquals(ProjectStatus.IN_PROGRESS, p.getStatus());
        System.out.println("[OK] test4_progressUpdate progress=75");
    }

    @Test
    @Order(5)
    @Transactional
    void test5_materialAndPhoto() {
        var m = restorationService.addMaterial(PROJECT_ID,
            com.heritage.restoration.entity.RestorationMaterial.builder()
                .name("B72丙酮溶液").unit(com.heritage.restoration.enums.MaterialUnit.ML)
                .quantity(200.0).unitPrice(new BigDecimal("0.85")).supplier("文物保护材料厂").build(),
            "u_r1", "修复师A");
        assertNotNull(m.getId());
        assertEquals(170.0, m.getTotalPrice().doubleValue(), 0.001);
        var ph = restorationService.addPhoto(PROJECT_ID,
            com.heritage.restoration.entity.RestorationPhoto.builder()
                .url("http://minio/test/before.jpg").caption("修复前正面").stage(com.heritage.restoration.entity.RestorationPhoto.PhotoStage.BEFORE).build(),
            "u_r1", "修复师A");
        assertNotNull(ph.getId());
        System.out.println("[OK] test5_materialAndPhoto 耗材和照片添加成功");
    }

    @Test
    @Order(6)
    @Transactional
    void test6_stats() {
        var s = restorationService.getStats();
        assertNotNull(s);
        System.out.println("[OK] test6_stats total=" + s.get("total") +
            ", totalBudget=" + s.get("totalBudget"));
    }

    @Test
    @Order(7)
    @Transactional
    void test99_deleteProject() {
        if (PROJECT_ID != null) {
            restorationService.delete(PROJECT_ID, "u_admin", "测试管理员");
            assertTrue(projectRepository.findById(PROJECT_ID).map(RestorationProject::getDeleted).orElse(true));
            System.out.println("[OK] test99_deleteProject 软删除成功");
        }
    }
}
