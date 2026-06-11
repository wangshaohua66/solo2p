package com.scriptkill.service;

import com.scriptkill.dto.risk.PlayerRiskInfo;
import com.scriptkill.entity.User;
import com.scriptkill.exception.BusinessException;
import com.scriptkill.repository.BookingRepository;
import com.scriptkill.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Service
public class RiskService {

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;

    private static final int BASE_CREDIT_SCORE = 100;
    private static final int NO_SHOW_PENALTY = 15;
    private static final int LATE_CANCEL_PENALTY = 5;
    private static final int NORMAL_BOOKING_BONUS = 1;
    private static final int MIN_CREDIT_SCORE = 0;
    private static final int MAX_CREDIT_SCORE = 100;
    private static final int LATE_CANCEL_HOURS = 6;

    public RiskService(UserRepository userRepository, BookingRepository bookingRepository) {
        this.userRepository = userRepository;
        this.bookingRepository = bookingRepository;
    }

    @Transactional(readOnly = true)
    public PlayerRiskInfo getPlayerRiskInfo(Long playerId) {
        User player = userRepository.findById(playerId)
                .orElseThrow(() -> new BusinessException("玩家不存在"));

        PlayerRiskInfo info = new PlayerRiskInfo();
        info.setPlayerId(playerId);
        info.setPlayerName(player.getNickname());
        info.setCreditScore(player.getCreditScore());
        info.setNoShowCount(player.getNoShowCount());
        info.setTotalBookingCount(player.getTotalBookingCount());

        double noShowRate = player.getTotalBookingCount() > 0
                ? (double) player.getNoShowCount() / player.getTotalBookingCount()
                : 0.0;
        info.setNoShowRate(Math.round(noShowRate * 1000.0) / 1000.0);

        String riskLevel = calculateRiskLevel(player.getCreditScore(), noShowRate);
        info.setRiskLevel(riskLevel);

        double depositMultiplier = calculateDepositMultiplier(riskLevel);
        info.setDepositMultiplier(depositMultiplier);

        info.setRequireDeposit(player.getCreditScore() < 80 || player.getNoShowCount() >= 2);

        info.setSuggestion(generateSuggestion(riskLevel, player));

        return info;
    }

    @Transactional
    public void recordNoShow(Long playerId, Long bookingId) {
        User player = userRepository.findById(playerId)
                .orElseThrow(() -> new BusinessException("玩家不存在"));

        player.setNoShowCount(player.getNoShowCount() + 1);

        int newScore = player.getCreditScore() - NO_SHOW_PENALTY;
        player.setCreditScore(Math.max(MIN_CREDIT_SCORE, newScore));

        userRepository.save(player);
    }

    @Transactional
    public void recordLateCancel(Long playerId, LocalDateTime sessionStartTime,
                                 LocalDateTime cancelTime) {
        User player = userRepository.findById(playerId)
                .orElseThrow(() -> new BusinessException("玩家不存在"));

        long hoursBefore = ChronoUnit.HOURS.between(cancelTime, sessionStartTime);

        if (hoursBefore < LATE_CANCEL_HOURS) {
            int newScore = player.getCreditScore() - LATE_CANCEL_PENALTY;
            player.setCreditScore(Math.max(MIN_CREDIT_SCORE, newScore));
            userRepository.save(player);
        }
    }

    @Transactional
    public void recordSuccessfulAttendance(Long playerId) {
        User player = userRepository.findById(playerId)
                .orElseThrow(() -> new BusinessException("玩家不存在"));

        player.setTotalBookingCount(player.getTotalBookingCount() + 1);

        if (player.getNoShowCount() == 0) {
            int newScore = player.getCreditScore() + NORMAL_BOOKING_BONUS;
            player.setCreditScore(Math.min(MAX_CREDIT_SCORE, newScore));
        }

        userRepository.save(player);
    }

    public boolean canBookWithoutDeposit(Long playerId) {
        User player = userRepository.findById(playerId)
                .orElseThrow(() -> new BusinessException("玩家不存在"));

        return player.getCreditScore() >= 80 && player.getNoShowCount() < 2;
    }

    public int calculateRequiredDeposit(Long playerId, int baseDeposit) {
        PlayerRiskInfo riskInfo = getPlayerRiskInfo(playerId);
        return (int) (baseDeposit * riskInfo.getDepositMultiplier());
    }

    public boolean isHighRiskPlayer(Long playerId) {
        PlayerRiskInfo riskInfo = getPlayerRiskInfo(playerId);
        return "HIGH".equals(riskInfo.getRiskLevel()) || "CRITICAL".equals(riskInfo.getRiskLevel());
    }

    private String calculateRiskLevel(int creditScore, double noShowRate) {
        if (creditScore < 30 || noShowRate >= 0.3) {
            return "CRITICAL";
        } else if (creditScore < 50 || noShowRate >= 0.2) {
            return "HIGH";
        } else if (creditScore < 70 || noShowRate >= 0.1) {
            return "MEDIUM";
        } else {
            return "LOW";
        }
    }

    private double calculateDepositMultiplier(String riskLevel) {
        return switch (riskLevel) {
            case "LOW" -> 1.0;
            case "MEDIUM" -> 1.5;
            case "HIGH" -> 2.0;
            case "CRITICAL" -> 3.0;
            default -> 1.0;
        };
    }

    private String generateSuggestion(String riskLevel, User player) {
        return switch (riskLevel) {
            case "LOW" -> "信用良好，可享受免定金预订";
            case "MEDIUM" -> "信用一般，需支付标准定金";
            case "HIGH" -> "信用较差，需支付双倍定金，且需店长审核";
            case "CRITICAL" -> "高风险玩家，需支付三倍定金，可能被限制预订";
            default -> "信用状态未知";
        };
    }
}
