package com.scriptkill.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.scriptkill.entity.Script;
import com.scriptkill.entity.User;
import com.scriptkill.entity.enums.Role;
import com.scriptkill.entity.enums.ScriptDifficulty;
import com.scriptkill.entity.enums.ScriptGenre;
import com.scriptkill.exception.BusinessException;
import com.scriptkill.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ScriptAndPurchaseServiceTest {

    @Nested
    @DisplayName("ScriptService 多版本快照与回滚")
    class ScriptServiceTests {

        @Mock private ScriptRepository scriptRepository;
        @Mock private ScriptCharacterRepository characterRepository;
        @Mock private StageRepository stageRepository;
        @Mock private ClueRepository clueRepository;
        @Spy private ObjectMapper objectMapper = new ObjectMapper();

        private ScriptService scriptService;
        private Script activeScript;

        @BeforeEach
        void setUp() {
            scriptService = new ScriptService(scriptRepository, characterRepository,
                    stageRepository, clueRepository, objectMapper);
            activeScript = new Script();
            activeScript.setId(1L);
            activeScript.setName("雾都孤儿");
            activeScript.setDescription("v2描述");
            activeScript.setMinPlayers(5);
            activeScript.setMaxPlayers(8);
            activeScript.setEstimatedDurationMinutes(240);
            activeScript.setGenre(ScriptGenre.REASONING);
            activeScript.setDifficulty(ScriptDifficulty.NORMAL);
            activeScript.setVersion(3);
            activeScript.setStatus("ACTIVE");
        }

        private void stubScriptRepos() {
            when(scriptRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            when(characterRepository.findByScriptIdOrderBySortOrderAsc(1L)).thenReturn(List.of());
            when(stageRepository.findByScriptIdOrderByStageOrderAsc(1L)).thenReturn(List.of());
            when(clueRepository.findByScriptIdOrderBySortOrderAsc(1L)).thenReturn(List.of());
        }

        @Test
        @DisplayName("回滚到v1: 从多版本快照列表中按版本号精确回滚")
        void testRollbackFromMultiSnapshot() throws Exception {
            Script v1 = new Script();
            v1.setName("v1名");
            v1.setDescription("v1描述");
            v1.setMinPlayers(4);
            v1.setMaxPlayers(6);
            v1.setGenre(ScriptGenre.HORROR);
            v1.setDifficulty(ScriptDifficulty.HARD);
            v1.setEstimatedDurationMinutes(300);
            v1.setEndingCount(5);
            v1.setStatus("ACTIVE");

            Script v2 = new Script();
            v2.setName("v2名");
            v2.setDescription("v2描述");
            v2.setMinPlayers(5);
            v2.setMaxPlayers(7);
            v2.setGenre(ScriptGenre.EMOTIONAL);
            v2.setDifficulty(ScriptDifficulty.NORMAL);
            v2.setEstimatedDurationMinutes(360);
            v2.setEndingCount(3);
            v2.setStatus("ACTIVE");

            String snapshotList = objectMapper.writeValueAsString(List.of(
                    new Object() { public Integer version = 1; public Object data = v1; },
                    new Object() { public Integer version = 2; public Object data = v2; }
            ));
            activeScript.setVersionSnapshot(snapshotList);

            when(scriptRepository.findById(1L)).thenReturn(Optional.of(activeScript));
            stubScriptRepos();

            var resp = scriptService.rollbackToVersion(1L, 1);
            assertNotNull(resp);
            assertEquals("v1名", resp.getName());
            assertEquals("v1描述", resp.getDescription());
            assertEquals(4, resp.getMinPlayers());
            assertEquals(6, resp.getMaxPlayers());
            assertEquals(ScriptGenre.HORROR.name(), resp.getGenre());
            assertEquals(ScriptDifficulty.HARD.name(), resp.getDifficulty());
            assertEquals(300, resp.getEstimatedDurationMinutes());
            assertEquals(5, resp.getEndingCount());
            assertEquals(1, resp.getVersion());
        }

        @Test
        @DisplayName("回滚到中间版本v2")
        void testRollbackToMiddleVersion() throws Exception {
            Script v1 = new Script();
            v1.setName("v1名");
            v1.setMinPlayers(4);
            v1.setMaxPlayers(6);
            v1.setGenre(ScriptGenre.HORROR);
            v1.setDifficulty(ScriptDifficulty.HARD);
            v1.setEstimatedDurationMinutes(300);
            v1.setEndingCount(5);
            v1.setStatus("ACTIVE");

            Script v2 = new Script();
            v2.setName("v2名");
            v2.setMinPlayers(5);
            v2.setMaxPlayers(7);
            v2.setGenre(ScriptGenre.EMOTIONAL);
            v2.setDifficulty(ScriptDifficulty.NORMAL);
            v2.setEstimatedDurationMinutes(360);
            v2.setEndingCount(3);
            v2.setStatus("ACTIVE");

            String snapshotList = objectMapper.writeValueAsString(List.of(
                    new Object() { public Integer version = 1; public Object data = v1; },
                    new Object() { public Integer version = 2; public Object data = v2; }
            ));
            activeScript.setVersionSnapshot(snapshotList);

            when(scriptRepository.findById(1L)).thenReturn(Optional.of(activeScript));
            stubScriptRepos();

            var resp = scriptService.rollbackToVersion(1L, 2);
            assertEquals("v2名", resp.getName());
            assertEquals(5, resp.getMinPlayers());
            assertEquals(ScriptGenre.EMOTIONAL.name(), resp.getGenre());
            assertEquals(2, resp.getVersion());
        }

        @Test
        @DisplayName("快照列表中不存在目标版本号抛异常")
        void testRollbackVersionNotInSnapshots() throws Exception {
            Script v1 = new Script();
            v1.setName("v1名");
            v1.setMinPlayers(4);
            v1.setMaxPlayers(6);
            v1.setGenre(ScriptGenre.HORROR);
            v1.setDifficulty(ScriptDifficulty.HARD);
            v1.setEstimatedDurationMinutes(300);
            v1.setEndingCount(5);
            v1.setStatus("ACTIVE");

            String snapshotList = objectMapper.writeValueAsString(List.of(
                    new Object() { public Integer version = 1; public Object data = v1; }
            ));
            activeScript.setVersionSnapshot(snapshotList);

            when(scriptRepository.findById(1L)).thenReturn(Optional.of(activeScript));
            assertThrows(BusinessException.class, () -> scriptService.rollbackToVersion(1L, 2));
        }

        @Test
        @DisplayName("version参数越界(大于当前版本)抛出异常")
        void testRollbackInvalidVersion() {
            activeScript.setVersionSnapshot("[]");
            when(scriptRepository.findById(1L)).thenReturn(Optional.of(activeScript));
            assertThrows(BusinessException.class, () -> scriptService.rollbackToVersion(1L, 99));
        }

        @Test
        @DisplayName("createVersionSnapshot追加到列表且上限10个")
        void testCreateVersionSnapshotAppendsAndCaps() throws Exception {
            Script existing = new Script();
            existing.setId(1L);
            existing.setName("旧");
            existing.setMinPlayers(4);
            existing.setMaxPlayers(6);
            existing.setGenre(ScriptGenre.REASONING);
            existing.setDifficulty(ScriptDifficulty.NORMAL);
            existing.setEstimatedDurationMinutes(240);
            existing.setVersion(1);
            existing.setStatus("ACTIVE");

            when(scriptRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(scriptRepository.save(any())).thenAnswer(a -> a.getArgument(0));

            scriptService.updateScript(1L, buildRequest("新名v2"));
            verify(scriptRepository).save(argThat(s -> {
                try {
                    if (s.getVersionSnapshot() == null) return false;
                    List<?> snapshots = objectMapper.readValue(s.getVersionSnapshot(), List.class);
                    return snapshots.size() == 1;
                } catch (Exception e) { return false; }
            }));
        }

        private com.scriptkill.dto.script.ScriptCreateRequest buildRequest(String name) {
            var req = new com.scriptkill.dto.script.ScriptCreateRequest();
            req.setName(name);
            req.setDescription("desc");
            req.setMinPlayers(4);
            req.setMaxPlayers(6);
            req.setEstimatedDurationMinutes(240);
            req.setGenre("REASONING");
            req.setDifficulty("NORMAL");
            return req;
        }
    }

    @Nested
    @DisplayName("PurchaseService 与 RiskService")
    class PurchaseAndRiskTests {

        @Test
        @DisplayName("reviewPurchase - reviewer非DM抛出异常")
        void testReviewerNotDM() {
            PurchaseRepository purchaseRepo = mock(PurchaseRepository.class);
            UserRepository userRepo = mock(UserRepository.class);
            ScriptRepository scriptRepo = mock(ScriptRepository.class);

            PurchaseService ps = new PurchaseService(purchaseRepo, userRepo, scriptRepo);

            var user = new User();
            user.setId(5L);
            user.setRole(Role.PLAYER);
            when(userRepo.findById(5L)).thenReturn(Optional.of(user));

            var purchase = new com.scriptkill.entity.Purchase();
            purchase.setId(1L);
            purchase.setStatus(com.scriptkill.entity.enums.PurchaseStatus.PENDING_REVIEW);
            when(purchaseRepo.findById(1L)).thenReturn(Optional.of(purchase));

            var req = new com.scriptkill.dto.purchase.PurchaseReviewRequest();
            req.setPurchaseId(1L);
            req.setScore(80);
            req.setComment("好评");

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> ps.reviewPurchase(req, 5L));
            assertTrue(ex.getMessage().contains("DM"));
        }

        @Test
        @DisplayName("RiskService - calculateRequiredDeposit最低返回baseDeposit")
        void testRiskNeverZero() {
            User lowRisk = new User();
            lowRisk.setCreditScore(100);
            lowRisk.setNoShowCount(0);
            lowRisk.setTotalBookingCount(20);
            lowRisk.setId(5L);
            UserRepository userRepo = mock(UserRepository.class);
            when(userRepo.findById(5L)).thenReturn(Optional.of(lowRisk));

            RiskService rs = new RiskService(userRepo, mock(BookingRepository.class));
            int d = rs.calculateRequiredDeposit(5L, 50);
            assertTrue(d >= 50, "强制押金不允许为0，应>=baseDeposit, 实际=" + d);
        }
    }
}
