package com.scriptkill.service;

import com.scriptkill.dto.risk.PlayerRiskInfo;
import com.scriptkill.entity.User;
import com.scriptkill.entity.enums.Role;
import com.scriptkill.repository.BookingRepository;
import com.scriptkill.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RiskServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private BookingRepository bookingRepository;

    @InjectMocks
    private RiskService riskService;

    private User lowRiskPlayer;
    private User highRiskPlayer;
    private User criticalRiskPlayer;

    @BeforeEach
    void setUp() {
        lowRiskPlayer = new User();
        lowRiskPlayer.setId(1L);
        lowRiskPlayer.setUsername("player_good");
        lowRiskPlayer.setNickname("好玩家");
        lowRiskPlayer.setRole(Role.PLAYER);
        lowRiskPlayer.setCreditScore(95);
        lowRiskPlayer.setNoShowCount(0);
        lowRiskPlayer.setTotalBookingCount(20);

        highRiskPlayer = new User();
        highRiskPlayer.setId(2L);
        highRiskPlayer.setUsername("player_bad");
        highRiskPlayer.setNickname("坏玩家");
        highRiskPlayer.setRole(Role.PLAYER);
        highRiskPlayer.setCreditScore(55);
        highRiskPlayer.setNoShowCount(3);
        highRiskPlayer.setTotalBookingCount(15);

        criticalRiskPlayer = new User();
        criticalRiskPlayer.setId(3L);
        criticalRiskPlayer.setUsername("player_worst");
        criticalRiskPlayer.setNickname("极差玩家");
        criticalRiskPlayer.setRole(Role.PLAYER);
        criticalRiskPlayer.setCreditScore(25);
        criticalRiskPlayer.setNoShowCount(5);
        criticalRiskPlayer.setTotalBookingCount(10);
    }

    @Test
    @DisplayName("低风险玩家评估")
    void getPlayerRiskInfo_LowRisk() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(lowRiskPlayer));

        PlayerRiskInfo info = riskService.getPlayerRiskInfo(1L);

        assertNotNull(info);
        assertEquals("LOW", info.getRiskLevel());
        assertEquals(95, info.getCreditScore());
        assertFalse(info.getRequireDeposit());
        assertEquals(1.0, info.getDepositMultiplier());
    }

    @Test
    @DisplayName("高风险玩家评估")
    void getPlayerRiskInfo_HighRisk() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(highRiskPlayer));

        PlayerRiskInfo info = riskService.getPlayerRiskInfo(2L);

        assertNotNull(info);
        assertEquals("HIGH", info.getRiskLevel());
        assertTrue(info.getRequireDeposit());
        assertEquals(2.0, info.getDepositMultiplier());
    }

    @Test
    @DisplayName("极高风险玩家评估")
    void getPlayerRiskInfo_CriticalRisk() {
        when(userRepository.findById(3L)).thenReturn(Optional.of(criticalRiskPlayer));

        PlayerRiskInfo info = riskService.getPlayerRiskInfo(3L);

        assertNotNull(info);
        assertEquals("CRITICAL", info.getRiskLevel());
        assertTrue(info.getRequireDeposit());
        assertEquals(3.0, info.getDepositMultiplier());
    }

    @Test
    @DisplayName("低风险玩家可免定金")
    void canBookWithoutDeposit_LowRisk_True() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(lowRiskPlayer));

        assertTrue(riskService.canBookWithoutDeposit(1L));
    }

    @Test
    @DisplayName("高风险玩家不可免定金")
    void canBookWithoutDeposit_HighRisk_False() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(highRiskPlayer));

        assertFalse(riskService.canBookWithoutDeposit(2L));
    }

    @Test
    @DisplayName("高风险玩家需双倍定金")
    void calculateRequiredDeposit_HighRisk_Double() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(highRiskPlayer));

        int requiredDeposit = riskService.calculateRequiredDeposit(2L, 50);

        assertEquals(100, requiredDeposit);
    }

    @Test
    @DisplayName("记录爽约扣减信用分")
    void recordNoShow_DecreaseCredit() {
        User player = new User();
        player.setId(1L);
        player.setCreditScore(100);
        player.setNoShowCount(0);

        when(userRepository.findById(1L)).thenReturn(Optional.of(player));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        riskService.recordNoShow(1L, 1L);

        assertEquals(85, player.getCreditScore());
        assertEquals(1, player.getNoShowCount());
    }

    @Test
    @DisplayName("成功到场增加信用分")
    void recordSuccessfulAttendance_IncreaseCredit() {
        User player = new User();
        player.setId(1L);
        player.setCreditScore(90);
        player.setNoShowCount(0);
        player.setTotalBookingCount(5);

        when(userRepository.findById(1L)).thenReturn(Optional.of(player));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        riskService.recordSuccessfulAttendance(1L);

        assertEquals(91, player.getCreditScore());
        assertEquals(6, player.getTotalBookingCount());
    }

    @Test
    @DisplayName("信用分不低于最小值")
    void recordNoShow_MinCreditScore() {
        User player = new User();
        player.setId(1L);
        player.setCreditScore(10);
        player.setNoShowCount(5);

        when(userRepository.findById(1L)).thenReturn(Optional.of(player));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        riskService.recordNoShow(1L, 1L);

        assertEquals(0, player.getCreditScore());
    }

    @Test
    @DisplayName("信用分不超过最大值")
    void recordSuccessfulAttendance_MaxCreditScore() {
        User player = new User();
        player.setId(1L);
        player.setCreditScore(100);
        player.setNoShowCount(0);
        player.setTotalBookingCount(50);

        when(userRepository.findById(1L)).thenReturn(Optional.of(player));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        riskService.recordSuccessfulAttendance(1L);

        assertEquals(100, player.getCreditScore());
    }
}
