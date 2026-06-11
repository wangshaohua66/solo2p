package com.scriptkill.service;

import com.scriptkill.dto.player.PlayerProfileResponse;
import com.scriptkill.entity.PlayerProfile;
import com.scriptkill.entity.User;
import com.scriptkill.entity.enums.Role;
import com.scriptkill.exception.BusinessException;
import com.scriptkill.repository.PlayerProfileRepository;
import com.scriptkill.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PlayerService {

    private final PlayerProfileRepository playerProfileRepository;
    private final UserRepository userRepository;

    public PlayerService(PlayerProfileRepository playerProfileRepository,
                         UserRepository userRepository) {
        this.playerProfileRepository = playerProfileRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public PlayerProfileResponse getPlayerProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("用户不存在"));

        PlayerProfile profile = playerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException("玩家档案不存在"));

        return convertToResponse(profile, user);
    }

    @Transactional(readOnly = true)
    public PlayerProfile getPlayerProfileEntity(Long userId) {
        return playerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException("玩家档案不存在"));
    }

    @Transactional(readOnly = true)
    public List<User> getAllPlayers() {
        return userRepository.findByRoleAndEnabledTrue(Role.PLAYER);
    }

    @Transactional
    public PlayerProfile createPlayerProfile(User user) {
        if (playerProfileRepository.existsByUserId(user.getId())) {
            throw new BusinessException("玩家档案已存在");
        }

        PlayerProfile profile = new PlayerProfile();
        profile.setUser(user);
        profile.setMemberLevel("NORMAL");
        profile.setHorrorTolerance(5);
        profile.setEmotionalSensitivity(5);
        profile.setReasoningAbility(5);
        profile.setSocialLevel(5);

        return playerProfileRepository.save(profile);
    }

    private PlayerProfileResponse convertToResponse(PlayerProfile profile, User user) {
        PlayerProfileResponse response = new PlayerProfileResponse();
        response.setId(profile.getId());
        response.setUserId(user.getId());
        response.setUsername(user.getUsername());
        response.setNickname(user.getNickname());
        response.setRealName(profile.getRealName());
        response.setAgeGroup(profile.getAgeGroup());
        response.setGender(profile.getGender());
        response.setPreferredGenre(profile.getPreferredGenre());
        response.setPlayCount(profile.getPlayCount());
        response.setAverageRating(profile.getAverageRating());
        response.setHistoryScore(profile.getHistoryScore());
        response.setPreferenceTags(profile.getPreferenceTags());
        response.setHorrorTolerance(profile.getHorrorTolerance());
        response.setEmotionalSensitivity(profile.getEmotionalSensitivity());
        response.setReasoningAbility(profile.getReasoningAbility());
        response.setSocialLevel(profile.getSocialLevel());
        response.setBirthday(profile.getBirthday());
        response.setMemberLevel(profile.getMemberLevel());
        response.setTotalSpent(profile.getTotalSpent());
        response.setCreditScore(user.getCreditScore());
        response.setNoShowCount(user.getNoShowCount());
        return response;
    }
}
