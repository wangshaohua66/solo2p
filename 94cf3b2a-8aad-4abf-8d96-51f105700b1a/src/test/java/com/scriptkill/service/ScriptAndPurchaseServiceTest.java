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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ScriptAndPurchaseServiceTest {

    @Mock
    private ScriptRepository scriptRepository;
    @Mock
    private ScriptCharacterRepository characterRepository;
    @Mock
    private StageRepository stageRepository;
    @Mock
    private ClueRepository clueRepository;
    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks
    private ScriptService scriptService;

    @Mock
    private PurchaseRepository purchaseRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ScriptRepository purchaseScriptRepository;
    @InjectMocks
    private PurchaseService purchaseService;

    private Script activeScript;

    @BeforeEach
    void setUp() {
        activeScript = new Script();
        activeScript.setId(1L);
        activeScript.setName("雾都孤儿");
        activeScript.setDescription("初版");
        activeScript.setMinPlayers(5);
        activeScript.setMaxPlayers(8);
        activeScript.setEstimatedDurationMinutes(240);
        activeScript.setGenre(ScriptGenre.REASONING);
        activeScript.setDifficulty(ScriptDifficulty.NORMAL);
        activeScript.setVersion(2);
        activeScript.setStatus("ACTIVE");
    }

    @Test
    @DisplayName("功能2：rollbackToVersion - 从JSON快照反序列化全部字段，version参数生效")
    void testRollbackFromSnapshot() throws Exception {
        Script original = new Script();
        original.setName("旧名");
        original.setDescription("旧描述");
        original.setMinPlayers(4);
        original.setMaxPlayers(6);
        original.setGenre(ScriptGenre.HORROR);
        original.setDifficulty(ScriptDifficulty.HARD);
        original.setEstimatedDurationMinutes(300);
        original.setEndingCount(5);
        original.setStatus("ACTIVE");

        String snapshot = objectMapper.writeValueAsString(original);
        activeScript.setVersionSnapshot(snapshot);

        when(scriptRepository.findById(1L)).thenReturn(Optional.of(activeScript));
        when(scriptRepository.save(any())).thenAnswer(a -> a.getArgument(0));
        when(characterRepository.findByScriptIdOrderBySortOrderAsc(1L)).thenReturn(java.util.List.of());
        when(stageRepository.findByScriptIdOrderByStageOrderAsc(1L)).thenReturn(java.util.List.of());
        when(clueRepository.findByScriptIdOrderBySortOrderAsc(1L)).thenReturn(java.util.List.of());

        var resp = scriptService.rollbackToVersion(1L, 1);

        assertNotNull(resp);
        assertEquals("旧名", resp.getName());
        assertEquals("旧描述", resp.getDescription());
        assertEquals(4, resp.getMinPlayers());
        assertEquals(6, resp.getMaxPlayers());
        assertEquals(ScriptGenre.HORROR.name(), resp.getGenre());
        assertEquals(ScriptDifficulty.HARD.name(), resp.getDifficulty());
        assertEquals(300, resp.getEstimatedDurationMinutes());
        assertEquals(5, resp.getEndingCount());
        assertEquals(1, resp.getVersion());
    }

    @Test
    @DisplayName("功能2：rollbackToVersion - version参数越界抛出异常")
    void testRollbackInvalidVersion() {
        activeScript.setVersionSnapshot("{}");
        when(scriptRepository.findById(1L)).thenReturn(Optional.of(activeScript));
        assertThrows(BusinessException.class, () -> scriptService.rollbackToVersion(1L, 99));
    }

    @Test
    @DisplayName("功能4：reviewPurchase - reviewer非DM抛出异常")
    void testReviewerNotDM() {
        var user = new User();
        user.setId(5L);
        user.setRole(Role.PLAYER);
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));

        var purchase = new com.scriptkill.entity.Purchase();
        purchase.setId(1L);
        purchase.setStatus(com.scriptkill.entity.enums.PurchaseStatus.PENDING_REVIEW);
        when(purchaseRepository.findById(1L)).thenReturn(Optional.of(purchase));

        var req = new com.scriptkill.dto.purchase.PurchaseReviewRequest();
        req.setPurchaseId(1L);
        req.setScore(80);
        req.setComment("好评");

        BusinessException ex = assertThrows(BusinessException.class,
                () -> purchaseService.reviewPurchase(req, 5L));
        assertTrue(ex.getMessage().contains("DM"));
    }

    @Test
    @DisplayName("功能1: RiskService - calculateRequiredDeposit最低返回baseDeposit（不返回0）")
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
