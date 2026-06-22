package com.heritage.service;

import com.heritage.entity.Booking;
import com.heritage.entity.Notification;
import com.heritage.entity.User;
import com.heritage.enums.BookingStatus;
import com.heritage.repository.BookingRepository;
import com.heritage.repository.NotificationRepository;
import com.heritage.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class BookingService {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    public Page<Booking> getAllBookings(Pageable pageable) {
        return bookingRepository.findAll(pageable);
    }

    public Page<Booking> getBookingsByInstitution(String institutionId, Pageable pageable) {
        return bookingRepository.findByInstitutionId(institutionId, pageable);
    }

    public Page<Booking> getBookingsByInheritor(String inheritorId, Pageable pageable) {
        return bookingRepository.findByInheritorId(inheritorId, pageable);
    }

    public Page<Booking> getBookingsByStatus(BookingStatus status, Pageable pageable) {
        return bookingRepository.findByStatus(status, pageable);
    }

    public Booking getBookingById(String id) {
        return bookingRepository.findById(id).orElse(null);
    }

    public boolean hasConflict(String inheritorId, LocalDateTime startTime, LocalDateTime endTime) {
        List<Booking> conflicts = bookingRepository.findConflictingBookings(inheritorId, startTime, endTime);
        return !conflicts.isEmpty();
    }

    public List<Booking> getBookingsInDateRange(String inheritorId, LocalDateTime start, LocalDateTime end) {
        return bookingRepository.findByInheritorIdAndDateRange(inheritorId, start, end);
    }

    @Transactional
    public Booking createBooking(Booking booking) {
        if (hasConflict(booking.getInheritorId(), booking.getStartTime(), booking.getEndTime())) {
            throw new RuntimeException("所选时间段与已有预约冲突，请重新选择时间");
        }

        booking.setId(null);
        booking.setStatus(BookingStatus.PENDING);

        Booking saved = bookingRepository.save(booking);

        sendNotification(
                saved.getInheritorId(),
                "新的研学预约申请",
                "您有新的研学预约申请待处理：" + saved.getInstitutionName(),
                saved.getId(),
                "BOOKING"
        );

        sendBookingEmail(saved, "PENDING",
                "新的研学预约申请",
                "您有新的研学预约申请待处理：" + saved.getInstitutionName() +
                "，时间：" + saved.getStartTime() + " 至 " + saved.getEndTime());

        return saved;
    }

    @Transactional
    public Booking approveBooking(String id, String approverId, String remark) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("预约不存在"));

        booking.setStatus(BookingStatus.APPROVED);
        booking.setApprovalRemark(remark);
        booking.setApprovedBy(approverId);
        booking.setApprovedAt(LocalDateTime.now());

        Booking saved = bookingRepository.save(booking);

        sendNotification(
                saved.getInstitutionId(),
                "预约已批准",
                "您的研学预约已获批准：" + saved.getInstitutionName(),
                saved.getId(),
                "BOOKING"
        );

        sendBookingEmail(saved, "APPROVED",
                "研学预约已批准",
                "您的研学预约已获批准！" +
                "，项目：" + saved.getInstitutionName() +
                "，时间：" + saved.getStartTime() + " 至 " + saved.getEndTime() +
                (remark != null && !remark.isEmpty() ? "，审批备注：" + remark : ""));

        return saved;
    }

    @Transactional
    public Booking rejectBooking(String id, String approverId, String remark) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("预约不存在"));

        booking.setStatus(BookingStatus.REJECTED);
        booking.setApprovalRemark(remark);
        booking.setApprovedBy(approverId);
        booking.setApprovedAt(LocalDateTime.now());

        Booking saved = bookingRepository.save(booking);

        sendNotification(
                saved.getInstitutionId(),
                "预约被拒绝",
                "您的研学预约已被拒绝：" + remark,
                saved.getId(),
                "BOOKING"
        );

        sendBookingEmail(saved, "REJECTED",
                "研学预约被拒绝",
                "您的研学预约已被拒绝。" +
                "，项目：" + saved.getInstitutionName() +
                "，拒绝原因：" + remark);

        return saved;
    }

    @Transactional
    public Booking cancelBooking(String id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("预约不存在"));

        booking.setStatus(BookingStatus.CANCELLED);
        Booking saved = bookingRepository.save(booking);

        sendBookingEmail(saved, "CANCELLED",
                "研学预约已取消",
                "研学预约已取消：" + saved.getInstitutionName() +
                "，时间：" + saved.getStartTime() + " 至 " + saved.getEndTime());

        return saved;
    }

    private void sendNotification(String userId, String title, String content, String relatedId, String type) {
        Notification notification = Notification.builder()
                .userId(userId)
                .title(title)
                .content(content)
                .type(type)
                .relatedId(relatedId)
                .read(false)
                .emailSent(false)
                .build();
        notificationRepository.save(notification);
    }

    private void sendBookingEmail(Booking booking, String status, String subject, String content) {
        String institutionEmail = booking.getContactEmail();
        if (institutionEmail != null && !institutionEmail.isEmpty()) {
            String htmlContent = emailService.buildBookingNotificationHtml(subject, content, booking.getId(), status);
            emailService.sendHtmlEmail(institutionEmail, subject, htmlContent);
        }

        userRepository.findById(booking.getInheritorId()).ifPresent(inheritor -> {
            if (inheritor.getEmail() != null && !inheritor.getEmail().isEmpty()) {
                String htmlContent = emailService.buildBookingNotificationHtml(subject, content, booking.getId(), status);
                emailService.sendHtmlEmail(inheritor.getEmail(), subject, htmlContent);
            }
        });
    }
}
