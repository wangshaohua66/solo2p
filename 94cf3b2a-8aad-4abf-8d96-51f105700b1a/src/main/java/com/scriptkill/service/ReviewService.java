package com.scriptkill.service;

import com.scriptkill.dto.review.RadarChartData;
import com.scriptkill.dto.review.ReviewCreateRequest;
import com.scriptkill.dto.review.ReviewResponse;
import com.scriptkill.entity.*;
import com.scriptkill.entity.enums.SessionStatus;
import com.scriptkill.exception.BusinessException;
import com.scriptkill.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final ScriptRepository scriptRepository;
    private final BookingRepository bookingRepository;

    public ReviewService(ReviewRepository reviewRepository,
                         SessionRepository sessionRepository,
                         UserRepository userRepository,
                         ScriptRepository scriptRepository,
                         BookingRepository bookingRepository) {
        this.reviewRepository = reviewRepository;
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.scriptRepository = scriptRepository;
        this.bookingRepository = bookingRepository;
    }

    @Transactional
    public ReviewResponse createReview(ReviewCreateRequest request, Long playerId) {
        GameSession session = sessionRepository.findById(request.getSessionId())
                .orElseThrow(() -> new BusinessException("会话不存在"));

        if (session.getStatus() != SessionStatus.COMPLETED &&
                session.getStatus() != SessionStatus.REVIEWING) {
            throw new BusinessException("只有已结束或复盘中的场次可以评价");
        }

        User player = userRepository.findById(playerId)
                .orElseThrow(() -> new BusinessException("玩家不存在"));

        if (reviewRepository.existsBySessionIdAndPlayerId(request.getSessionId(), playerId)) {
            throw new BusinessException("您已经评价过该场次");
        }

        Booking booking = bookingRepository.findBySessionIdAndPlayerId(
                request.getSessionId(), playerId).orElse(null);

        Review review = new Review();
        review.setSession(session);
        review.setScript(session.getScript());
        review.setPlayer(player);
        review.setScriptRating(request.getScriptRating());
        review.setDmProfessionalism(request.getDmProfessionalism());
        review.setCharacterFit(request.getCharacterFit());
        review.setOverallExperience(request.getOverallExperience());
        review.setStoryRating(request.getStoryRating());
        review.setPuzzleDifficultyRating(request.getPuzzleDifficultyRating());
        review.setAtmosphereRating(request.getAtmosphereRating());
        review.setIsAnonymous(request.getIsAnonymous() != null ? request.getIsAnonymous() : true);
        review.setComment(request.getComment());
        review.setSuggestions(request.getSuggestions());
        review.setWouldRecommend(request.getWouldRecommend());
        review.setEmotionalTags(request.getEmotionalTags());

        if (booking != null && booking.getAssignedCharacter() != null) {
            review.setCharacter(booking.getAssignedCharacter());
        }

        review = reviewRepository.save(review);

        updateScriptAverageRating(session.getScript().getId());

        return convertToResponse(review);
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> getSessionReviews(Long sessionId) {
        List<Review> reviews = reviewRepository.findBySessionId(sessionId);
        return reviews.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<ReviewResponse> getScriptReviews(Long scriptId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Review> reviewPage = reviewRepository.findByScriptId(scriptId, pageable);
        return reviewPage.map(this::convertToResponse);
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> getPlayerReviews(Long playerId) {
        List<Review> reviews = reviewRepository.findByPlayerId(playerId);
        return reviews.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public RadarChartData getScriptRadarChart(Long scriptId) {
        List<Review> reviews = reviewRepository.findByScriptId(scriptId);

        RadarChartData data = new RadarChartData();
        data.setSampleCount((long) reviews.size());

        if (reviews.isEmpty()) {
            data.setScriptRating(0.0);
            data.setDmProfessionalism(0.0);
            data.setCharacterFit(0.0);
            data.setOverallExperience(0.0);
            data.setStoryRating(0.0);
            data.setAtmosphereRating(0.0);
            return data;
        }

        double scriptRating = reviews.stream()
                .mapToInt(Review::getScriptRating).average().orElse(0.0);
        double dmProfessionalism = reviews.stream()
                .mapToInt(Review::getDmProfessionalism).average().orElse(0.0);
        double characterFit = reviews.stream()
                .mapToInt(Review::getCharacterFit).average().orElse(0.0);
        double overallExperience = reviews.stream()
                .mapToInt(Review::getOverallExperience).average().orElse(0.0);
        double storyRating = reviews.stream()
                .mapToInt(r -> r.getStoryRating() != null ? r.getStoryRating() : 0)
                .average().orElse(0.0);
        double atmosphereRating = reviews.stream()
                .mapToInt(r -> r.getAtmosphereRating() != null ? r.getAtmosphereRating() : 0)
                .average().orElse(0.0);

        data.setScriptRating(Math.round(scriptRating * 10.0) / 10.0);
        data.setDmProfessionalism(Math.round(dmProfessionalism * 10.0) / 10.0);
        data.setCharacterFit(Math.round(characterFit * 10.0) / 10.0);
        data.setOverallExperience(Math.round(overallExperience * 10.0) / 10.0);
        data.setStoryRating(Math.round(storyRating * 10.0) / 10.0);
        data.setAtmosphereRating(Math.round(atmosphereRating * 10.0) / 10.0);

        return data;
    }

    @Transactional(readOnly = true)
    public RadarChartData getDmRadarChart(Long dmId) {
        List<GameSession> dmSessions = sessionRepository.findByDmId(dmId);
        List<Long> sessionIds = dmSessions.stream()
                .map(GameSession::getId).collect(Collectors.toList());

        List<Review> allReviews = reviewRepository.findAll().stream()
                .filter(r -> sessionIds.contains(r.getSession().getId()))
                .collect(Collectors.toList());

        RadarChartData data = new RadarChartData();
        data.setSampleCount((long) allReviews.size());

        if (allReviews.isEmpty()) {
            data.setScriptRating(0.0);
            data.setDmProfessionalism(0.0);
            data.setCharacterFit(0.0);
            data.setOverallExperience(0.0);
            data.setStoryRating(0.0);
            data.setAtmosphereRating(0.0);
            return data;
        }

        double dmProfessionalism = allReviews.stream()
                .mapToInt(Review::getDmProfessionalism).average().orElse(0.0);
        double overallExperience = allReviews.stream()
                .mapToInt(Review::getOverallExperience).average().orElse(0.0);
        double atmosphereRating = allReviews.stream()
                .mapToInt(r -> r.getAtmosphereRating() != null ? r.getAtmosphereRating() : 0)
                .average().orElse(0.0);

        data.setDmProfessionalism(Math.round(dmProfessionalism * 10.0) / 10.0);
        data.setOverallExperience(Math.round(overallExperience * 10.0) / 10.0);
        data.setAtmosphereRating(Math.round(atmosphereRating * 10.0) / 10.0);
        data.setScriptRating(0.0);
        data.setCharacterFit(0.0);
        data.setStoryRating(0.0);

        return data;
    }

    @Transactional
    public void updateScriptAverageRating(Long scriptId) {
        Double avgRating = reviewRepository.calculateAverageScriptRating(scriptId);
        if (avgRating != null) {
            Script script = scriptRepository.findById(scriptId).orElse(null);
            if (script != null) {
                script.setAverageRating(Math.round(avgRating * 10.0) / 10.0);
                scriptRepository.save(script);
            }
        }
    }

    private ReviewResponse convertToResponse(Review review) {
        ReviewResponse response = new ReviewResponse();
        response.setId(review.getId());
        response.setSessionId(review.getSession().getId());
        response.setScriptId(review.getScript().getId());
        response.setPlayerId(review.getPlayer().getId());
        response.setPlayerName(review.getIsAnonymous() ? "匿名玩家" : review.getPlayer().getNickname());
        if (review.getCharacter() != null) {
            response.setCharacterId(review.getCharacter().getId());
            response.setCharacterName(review.getCharacter().getName());
        }
        response.setScriptRating(review.getScriptRating());
        response.setDmProfessionalism(review.getDmProfessionalism());
        response.setCharacterFit(review.getCharacterFit());
        response.setOverallExperience(review.getOverallExperience());
        response.setStoryRating(review.getStoryRating());
        response.setPuzzleDifficultyRating(review.getPuzzleDifficultyRating());
        response.setAtmosphereRating(review.getAtmosphereRating());
        response.setIsAnonymous(review.getIsAnonymous());
        response.setComment(review.getComment());
        response.setSuggestions(review.getSuggestions());
        response.setWouldRecommend(review.getWouldRecommend());
        response.setEmotionalTags(review.getEmotionalTags());
        response.setCreatedAt(review.getCreatedAt());
        return response;
    }
}
