package com.sportsevent.controller;

import com.sportsevent.dto.ApiResponse;
import com.sportsevent.engine.LeagueScheduler;
import com.sportsevent.engine.NotificationDispatcher;
import com.sportsevent.entity.Match;
import com.sportsevent.entity.Notification;
import com.sportsevent.entity.Referee;
import com.sportsevent.entity.Team;
import com.sportsevent.entity.Venue;
import com.sportsevent.exception.ResourceNotFoundException;
import com.sportsevent.repository.MatchRepository;
import com.sportsevent.repository.NotificationRepository;
import com.sportsevent.repository.RefereeRepository;
import com.sportsevent.repository.TeamRepository;
import com.sportsevent.repository.VenueRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Tag(name = "通知管理", description = "赛事通知推送接口，支持批量推送与送达状态跟踪")
public class NotificationController {

    private final NotificationRepository notificationRepository;
    private final NotificationDispatcher notificationDispatcher;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final RefereeRepository refereeRepository;
    private final VenueRepository venueRepository;
    private final LeagueScheduler leagueScheduler;

    @PostMapping
    @Operation(summary = "创建并发送通知")
    public ApiResponse<Notification> createAndSendNotification(@RequestBody Notification notification) {
        notification.setStatus(Notification.NotificationStatus.PENDING);
        notification.setScheduledAt(LocalDateTime.now());
        notification.setCreatedAt(LocalDateTime.now());
        notification.setUpdatedAt(LocalDateTime.now());
        notification.setRetryCount(0);

        Notification saved = notificationRepository.save(notification);
        notificationDispatcher.dispatch(saved);

        return ApiResponse.success("Notification created and dispatching", saved);
    }

    @GetMapping
    @Operation(summary = "查询通知列表")
    public ApiResponse<List<Notification>> listNotifications(
            @Parameter(description = "通知状态") @RequestParam(required = false) Notification.NotificationStatus status,
            @Parameter(description = "关联实体ID") @RequestParam(required = false) String relatedEntityId,
            @Parameter(description = "关联实体类型") @RequestParam(required = false) String relatedEntityType,
            @Parameter(description = "接收人ID") @RequestParam(required = false) String recipientId) {
        List<Notification> notifications;
        if (recipientId != null) {
            notifications = notificationRepository.findByRecipientId(recipientId);
        } else if (relatedEntityId != null && relatedEntityType != null) {
            notifications = notificationRepository.findByRelatedEntity(relatedEntityId, relatedEntityType);
        } else if (status != null) {
            notifications = notificationRepository.findByStatus(status);
        } else {
            notifications = notificationRepository.findAll();
        }
        return ApiResponse.success(notifications);
    }

    @GetMapping("/{id}")
    @Operation(summary = "查询通知详情")
    public ApiResponse<Notification> getNotification(@PathVariable String id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", id));
        return ApiResponse.success(notification);
    }

    @PostMapping("/{id}/resend")
    @Operation(summary = "重发通知")
    public ApiResponse<Notification> resendNotification(@PathVariable String id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", id));

        notification.setStatus(Notification.NotificationStatus.PENDING);
        notification.setRetryCount(notification.getRetryCount() + 1);
        notification.setUpdatedAt(LocalDateTime.now());
        Notification saved = notificationRepository.save(notification);

        notificationDispatcher.dispatch(saved);
        return ApiResponse.success("Notification resent", saved);
    }

    @PostMapping("/venue-change/{matchId}")
    @Operation(summary = "推送场馆变更通知",
            description = "场地临时变更时自动检测冲突、更新Match场地信息并推送通知到受影响参赛方")
    public ApiResponse<Match> sendVenueChangeNotification(
            @PathVariable String matchId,
            @Parameter(description = "新场馆ID") @RequestParam String newVenueId,
            @Parameter(description = "新场地号") @RequestParam(required = false) Integer newCourtNumber,
            @Parameter(description = "备注") @RequestParam(required = false) String remark) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match", matchId));

        String oldVenueId = match.getVenueId();
        Integer oldCourtNumber = match.getCourtNumber();

        match.setVenueId(newVenueId);
        if (newCourtNumber != null) {
            match.setCourtNumber(newCourtNumber);
        }

        List<Match.ConflictWarning> conflicts = leagueScheduler.validateMatchConflicts(match);
        match.setConflicts(conflicts);
        match.setUpdatedAt(LocalDateTime.now());

        Match savedMatch = matchRepository.save(match);

        List<Notification.Recipient> recipients = new ArrayList<>();

        if (match.getTeamAId() != null) {
            teamRepository.findById(match.getTeamAId()).ifPresent(team ->
                    recipients.add(buildTeamRecipient(team)));
        }
        if (match.getTeamBId() != null) {
            teamRepository.findById(match.getTeamBId()).ifPresent(team ->
                    recipients.add(buildTeamRecipient(team)));
        }

        if (match.getRefereeIds() != null) {
            for (String refId : match.getRefereeIds()) {
                Notification.Recipient r = new Notification.Recipient();
                r.setRecipientId(refId);
                r.setRecipientType(Notification.Recipient.RecipientType.REFEREE);
                r.setName("Referee:" + refId);
                recipients.add(r);
            }
        }

        Venue newVenue = venueRepository.findById(newVenueId).orElse(null);
        String venueName = newVenue != null ? newVenue.getName() : newVenueId;

        StringBuilder content = new StringBuilder();
        content.append(String.format("比赛场地已变更为：%s%s号场。",
                venueName, match.getCourtNumber() != null ? match.getCourtNumber() : ""));
        if (!conflicts.isEmpty()) {
            content.append("【注意】存在 ").append(conflicts.size()).append(" 项冲突警告。");
        }
        if (remark != null) {
            content.append("备注：").append(remark);
        }

        Notification notification = notificationDispatcher.createNotification(
                Notification.NotificationType.VENUE_CHANGE,
                "【重要】比赛场地变更通知",
                content.toString(),
                matchId,
                "Match",
                Notification.NotificationChannel.WECHAT_TEMPLATE,
                recipients
        );

        notificationDispatcher.dispatch(notification);

        return ApiResponse.success("Venue changed, notification sent to " + recipients.size() + " recipients",
                savedMatch);
    }

    @PostMapping("/schedule-change/{leagueId}")
    @Operation(summary = "推送赛程调整通知", description = "支持按队伍、裁判、场馆维度批量推送")
    public ApiResponse<Notification> sendScheduleChangeNotification(
            @PathVariable String leagueId,
            @Parameter(description = "通知目标类型") @RequestParam(defaultValue = "TEAM")
                Notification.Recipient.RecipientType targetType,
            @Parameter(description = "标题") @RequestParam String title,
            @Parameter(description = "内容") @RequestParam String content) {
        List<Notification.Recipient> recipients = new ArrayList<>();

        switch (targetType) {
            case TEAM:
                List<Team> teams = teamRepository.findAll();
                for (Team team : teams) {
                    Notification.Recipient r = new Notification.Recipient();
                    r.setRecipientId(team.getId());
                    r.setRecipientType(Notification.Recipient.RecipientType.TEAM);
                    r.setName(team.getName());
                    r.setContact(team.getLeaderPhone());
                    recipients.add(r);
                }
                break;

            case REFEREE:
                List<Referee> referees = refereeRepository.findAll();
                for (Referee referee : referees) {
                    Notification.Recipient r = new Notification.Recipient();
                    r.setRecipientId(referee.getId());
                    r.setRecipientType(Notification.Recipient.RecipientType.REFEREE);
                    r.setName(referee.getName());
                    r.setContact(referee.getPhone());
                    recipients.add(r);
                }
                break;

            case VENUE_MANAGER:
                List<Venue> venues = venueRepository.findAll();
                for (Venue venue : venues) {
                    Notification.Recipient r = new Notification.Recipient();
                    r.setRecipientId(venue.getId());
                    r.setRecipientType(Notification.Recipient.RecipientType.VENUE_MANAGER);
                    r.setName(venue.getName());
                    r.setContact(venue.getContactPhone());
                    recipients.add(r);
                }
                break;

            case ATHLETE:
            default:
                break;
        }

        Notification notification = notificationDispatcher.createNotification(
                Notification.NotificationType.SCHEDULE_CHANGE,
                title,
                content,
                leagueId,
                "League",
                Notification.NotificationChannel.WECHAT_TEMPLATE,
                recipients
        );

        notificationDispatcher.dispatch(notification);
        return ApiResponse.success("Schedule change notification sent to " + recipients.size() + " " + targetType + " recipients",
                notification);
    }

    @PostMapping("/match-reminder/{matchId}")
    @Operation(summary = "推送比赛提醒通知")
    public ApiResponse<Notification> sendMatchReminder(@PathVariable String matchId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match", matchId));

        List<Notification.Recipient> recipients = new ArrayList<>();

        if (match.getTeamAId() != null) {
            teamRepository.findById(match.getTeamAId()).ifPresent(team ->
                    recipients.add(buildTeamRecipient(team)));
        }
        if (match.getTeamBId() != null) {
            teamRepository.findById(match.getTeamBId()).ifPresent(team ->
                    recipients.add(buildTeamRecipient(team)));
        }

        String content = String.format("您有即将开始的比赛。时间：%s，场地：%s-%s号场",
                match.getStartTime() != null ? match.getStartTime() : "待定",
                match.getVenueId() != null ? match.getVenueId() : "待定",
                match.getCourtNumber() != null ? match.getCourtNumber() : "待定");

        Notification notification = notificationDispatcher.createNotification(
                Notification.NotificationType.MATCH_REMINDER,
                "比赛开始提醒",
                content,
                matchId,
                "Match",
                Notification.NotificationChannel.WECHAT_TEMPLATE,
                recipients
        );

        notificationDispatcher.dispatch(notification);
        return ApiResponse.success("Match reminder sent to " + recipients.size() + " recipients", notification);
    }

    @GetMapping("/stats/delivery")
    @Operation(summary = "查询通知送达统计")
    public ApiResponse<DeliveryStats> getDeliveryStats(
            @Parameter(description = "开始时间") @RequestParam(required = false) String startTime,
            @Parameter(description = "结束时间") @RequestParam(required = false) String endTime) {
        List<Notification> all = notificationRepository.findAll();

        DeliveryStats stats = new DeliveryStats();
        stats.setTotal(all.size());
        stats.setDelivered((int) all.stream()
                .filter(n -> n.getStatus() == Notification.NotificationStatus.DELIVERED).count());
        stats.setSent((int) all.stream()
                .filter(n -> n.getStatus() == Notification.NotificationStatus.SENT).count());
        stats.setFailed((int) all.stream()
                .filter(n -> n.getStatus() == Notification.NotificationStatus.FAILED).count());
        stats.setPending((int) all.stream()
                .filter(n -> n.getStatus() == Notification.NotificationStatus.PENDING).count());

        return ApiResponse.success(stats);
    }

    private Notification.Recipient buildTeamRecipient(Team team) {
        Notification.Recipient r = new Notification.Recipient();
        r.setRecipientId(team.getId());
        r.setRecipientType(Notification.Recipient.RecipientType.TEAM);
        r.setName(team.getName());
        r.setContact(team.getLeaderPhone());
        return r;
    }

    @lombok.Data
    public static class DeliveryStats {
        private int total;
        private int delivered;
        private int sent;
        private int failed;
        private int pending;
    }
}
