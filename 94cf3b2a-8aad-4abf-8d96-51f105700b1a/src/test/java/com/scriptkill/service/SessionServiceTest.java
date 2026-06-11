package com.scriptkill.service;

import com.scriptkill.dto.session.SessionResponse;
import com.scriptkill.entity.GameSession;
import com.scriptkill.entity.Script;
import com.scriptkill.entity.User;
import com.scriptkill.entity.enums.*;
import com.scriptkill.exception.BusinessException;
import com.scriptkill.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private SessionEventRepository sessionEventRepository;

    @Mock
    private ScriptRepository scriptRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private StageRepository stageRepository;

    @InjectMocks
    private SessionService sessionService;

    private Script testScript;
    private User testDm;
    private GameSession testSession;

    @BeforeEach
    void setUp() {
        testScript = new Script();
        testScript.setId(1L);
        testScript.setName("测试剧本");
        testScript.setMinPlayers(4);
        testScript.setMaxPlayers(8);
        testScript.setGenre(ScriptGenre.REASONING);
        testScript.setDifficulty(ScriptDifficulty.NORMAL);

        testDm = new User();
        testDm.setId(1L);
        testDm.setUsername("dm01");
        testDm.setNickname("测试DM");
        testDm.setRole(Role.DM);

        testSession = new GameSession();
        testSession.setId(1L);
        testSession.setScript(testScript);
        testSession.setDm(testDm);
        testSession.setStatus(SessionStatus.NOT_STARTED);
        testSession.setMaxPlayers(8);
        testSession.setCurrentPlayersCount(0);
        testSession.setPricePerPerson(128);
        testSession.setDifficultyFactor(1.0);
        testSession.setCreatedAt(LocalDateTime.now());
        testSession.setUpdatedAt(LocalDateTime.now());
    }

    @Test
    @DisplayName("获取会话详情 - 成功")
    void getSessionDetail_Success() {
        when(sessionRepository.findById(1L)).thenReturn(Optional.of(testSession));

        SessionResponse response = sessionService.getSessionDetail(1L);

        assertNotNull(response);
        assertEquals(1L, response.getId());
        assertEquals("测试剧本", response.getScriptName());
        assertEquals("测试DM", response.getDmName());
        assertEquals("NOT_STARTED", response.getStatus());
    }

    @Test
    @DisplayName("获取会话详情 - 会话不存在")
    void getSessionDetail_NotFound() {
        when(sessionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> {
            sessionService.getSessionDetail(999L);
        });
    }

    @Test
    @DisplayName("状态机 - 从未开始到拼场中")
    void startMatching_FromNotStarted_Success() {
        testSession.setStatus(SessionStatus.NOT_STARTED);
        when(sessionRepository.findById(1L)).thenReturn(Optional.of(testSession));
        when(sessionRepository.save(any(GameSession.class))).thenReturn(testSession);
        when(sessionEventRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        SessionResponse response = sessionService.startMatching(1L, 1L);

        assertNotNull(response);
        assertEquals("MATCHING", response.getStatus());
    }

    @Test
    @DisplayName("状态机 - 从拼场中到已确认")
    void confirmSession_FromMatching_Success() {
        testSession.setStatus(SessionStatus.MATCHING);
        when(sessionRepository.findById(1L)).thenReturn(Optional.of(testSession));
        when(bookingRepository.countConfirmedBookingsBySessionId(1L)).thenReturn(5L);
        when(sessionRepository.save(any(GameSession.class))).thenReturn(testSession);
        when(sessionEventRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        SessionResponse response = sessionService.confirmSession(1L, 1L);

        assertNotNull(response);
        assertEquals("CONFIRMED", response.getStatus());
    }

    @Test
    @DisplayName("状态机 - 人数不足时确认失败")
    void confirmSession_NotEnoughPlayers_Fail() {
        testSession.setStatus(SessionStatus.MATCHING);
        when(sessionRepository.findById(1L)).thenReturn(Optional.of(testSession));
        when(bookingRepository.countConfirmedBookingsBySessionId(1L)).thenReturn(2L);

        assertThrows(BusinessException.class, () -> {
            sessionService.confirmSession(1L, 1L);
        });
    }

    @Test
    @DisplayName("状态机 - 非法状态转换")
    void startPlaying_FromNotStarted_Fail() {
        testSession.setStatus(SessionStatus.NOT_STARTED);
        when(sessionRepository.findById(1L)).thenReturn(Optional.of(testSession));

        assertThrows(BusinessException.class, () -> {
            sessionService.startPlaying(1L, 1L);
        });
    }

    @Test
    @DisplayName("状态机 - 完成会话计算收入")
    void completeSession_CalculateRevenue_Success() {
        testSession.setStatus(SessionStatus.REVIEWING);
        when(sessionRepository.findById(1L)).thenReturn(Optional.of(testSession));
        when(bookingRepository.countConfirmedBookingsBySessionId(1L)).thenReturn(6L);
        when(sessionRepository.save(any(GameSession.class))).thenReturn(testSession);
        when(sessionEventRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(scriptRepository.save(any(Script.class))).thenReturn(testScript);

        SessionResponse response = sessionService.completeSession(1L, 1L);

        assertNotNull(response);
        assertEquals("COMPLETED", response.getStatus());
    }
}
