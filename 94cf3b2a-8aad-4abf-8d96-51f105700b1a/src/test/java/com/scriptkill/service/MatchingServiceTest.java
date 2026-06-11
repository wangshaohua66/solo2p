package com.scriptkill.service;

import com.scriptkill.dto.matching.MatchingPlan;
import com.scriptkill.entity.*;
import com.scriptkill.entity.enums.*;
import com.scriptkill.repository.ScriptCharacterRepository;
import com.scriptkill.repository.SessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MatchingServiceTest {

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private ScriptCharacterRepository characterRepository;

    @Mock
    private PlayerService playerService;

    @Mock
    private BookingService bookingService;

    @InjectMocks
    private MatchingService matchingService;

    private GameSession testSession;
    private Script testScript;

    @BeforeEach
    void setUp() {
        testScript = new Script();
        testScript.setId(1L);
        testScript.setName("推理剧本");
        testScript.setGenre(ScriptGenre.REASONING);
        testScript.setMinPlayers(4);
        testScript.setMaxPlayers(6);

        testSession = new GameSession();
        testSession.setId(1L);
        testSession.setScript(testScript);
        testSession.setMaxPlayers(6);

        User dm = new User();
        dm.setId(1L);
        dm.setRole(Role.DM);
        testSession.setDm(dm);
    }

    @Test
    @DisplayName("生成TOP3匹配方案")
    void generateTop3Plans_Success() {
        testSession.setMaxPlayers(3);
        when(sessionRepository.findById(1L)).thenReturn(Optional.of(testSession));
        when(bookingService.getConfirmedBookingCount(1L)).thenReturn(0L);

        List<Long> candidateIds = Arrays.asList(1L, 2L, 3L, 4L, 5L);

        for (int i = 1; i <= 5; i++) {
            User user = new User();
            user.setId((long) i);
            user.setNickname("玩家" + i);

            PlayerProfile profile = new PlayerProfile();
            profile.setId((long) i);
            profile.setUser(user);
            profile.setPreferredGenre("REASONING");
            profile.setAgeGroup("18-25");
            profile.setGender(i % 2 == 0 ? "女" : "男");
            profile.setHorrorTolerance(5);
            profile.setEmotionalSensitivity(5);
            profile.setReasoningAbility(7);
            profile.setSocialLevel(6);

            when(playerService.getPlayerProfileEntity((long) i)).thenReturn(profile);
        }

        List<ScriptCharacter> characters = new ArrayList<>();
        for (int i = 1; i <= 6; i++) {
            ScriptCharacter c = new ScriptCharacter();
            c.setId((long) i);
            c.setName("角色" + i);
            c.setGender(i % 2 == 0 ? "女" : "男");
            characters.add(c);
        }
        when(characterRepository.findByScriptIdAndGender(any(), any())).thenReturn(characters.subList(0, 3));

        List<MatchingPlan> plans = matchingService.generateTop3Plans(1L, candidateIds);

        assertNotNull(plans);
        assertTrue(plans.size() <= 3);
        assertFalse(plans.isEmpty());

        for (int i = 0; i < plans.size(); i++) {
            assertEquals(i + 1, plans.get(i).getRank());
            assertNotNull(plans.get(i).getTotalScore());
            assertNotNull(plans.get(i).getScoreDetail());
        }
    }

    @Test
    @DisplayName("候选人数不足时抛出异常")
    void generateTop3Plans_NotEnoughCandidates_Exception() {
        testSession.setMaxPlayers(10);
        when(sessionRepository.findById(1L)).thenReturn(Optional.of(testSession));
        when(bookingService.getConfirmedBookingCount(1L)).thenReturn(0L);

        List<Long> candidateIds = Arrays.asList(1L, 2L);

        assertThrows(Exception.class, () -> {
            matchingService.generateTop3Plans(1L, candidateIds);
        });
    }

    @Test
    @DisplayName("匹配分数在合理范围内")
    void generateTop3Plans_ScoreRange() {
        testSession.setMaxPlayers(2);
        when(sessionRepository.findById(1L)).thenReturn(Optional.of(testSession));
        when(bookingService.getConfirmedBookingCount(1L)).thenReturn(0L);

        List<Long> candidateIds = Arrays.asList(1L, 2L, 3L);

        for (int i = 1; i <= 3; i++) {
            User user = new User();
            user.setId((long) i);
            user.setNickname("玩家" + i);

            PlayerProfile profile = new PlayerProfile();
            profile.setId((long) i);
            profile.setUser(user);
            profile.setPreferredGenre("REASONING");
            profile.setAgeGroup("18-25");
            profile.setGender("男");
            profile.setHorrorTolerance(5);
            profile.setEmotionalSensitivity(5);
            profile.setReasoningAbility(5);
            profile.setSocialLevel(5);

            when(playerService.getPlayerProfileEntity((long) i)).thenReturn(profile);
        }

        List<MatchingPlan> plans = matchingService.generateTop3Plans(1L, candidateIds);

        for (MatchingPlan plan : plans) {
            assertTrue(plan.getTotalScore() >= 0);
            assertTrue(plan.getTotalScore() <= 100);
        }
    }
}
