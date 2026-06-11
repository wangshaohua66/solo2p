package com.glassstudio.service;

import com.glassstudio.dto.MaintenanceCreateDTO;
import com.glassstudio.entity.*;
import com.glassstudio.exception.NotFoundException;
import com.glassstudio.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EquipmentService {

    private final KilnRepository kilnRepository;
    private final MaintenanceOrderRepository maintenanceOrderRepository;
    private final NotificationService notificationService;

    public List<Kiln> getAllKilns() {
        return kilnRepository.findAll();
    }

    public Kiln getKilnById(Long id) {
        return kilnRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("窑炉不存在"));
    }

    @Transactional
    public Kiln createKiln(Kiln kiln) {
        kiln.setTotalFiringCount(0);
        kiln.setHealthStatus(HealthStatus.HEALTHY);
        return kilnRepository.save(kiln);
    }

    @Transactional
    public Kiln updateKiln(Long id, Kiln kilnDetails) {
        Kiln kiln = getKilnById(id);
        kiln.setName(kilnDetails.getName());
        kiln.setType(kilnDetails.getType());
        kiln.setMaxCapacity(kilnDetails.getMaxCapacity());
        kiln.setHeatingElementImpedance(kilnDetails.getHeatingElementImpedance());
        return kilnRepository.save(kiln);
    }

    @Transactional
    public void deleteKiln(Long id) {
        if (!kilnRepository.existsById(id)) {
            throw new NotFoundException("窑炉不存在");
        }
        kilnRepository.deleteById(id);
    }

    public HealthStatus calculateHealthStatus(Kiln kiln) {
        int score = 100;

        if (kiln.getTotalFiringCount() > 500) {
            score -= 30;
        } else if (kiln.getTotalFiringCount() > 200) {
            score -= 15;
        }

        if (kiln.getLastMaintenanceDate() != null) {
            long daysSinceMaintenance = ChronoUnit.DAYS.between(kiln.getLastMaintenanceDate(), LocalDateTime.now());
            if (daysSinceMaintenance > 180) {
                score -= 25;
            } else if (daysSinceMaintenance > 90) {
                score -= 10;
            }
        }

        if (kiln.getHeatingElementImpedance() != null) {
            BigDecimal impedance = kiln.getHeatingElementImpedance();
            if (impedance.compareTo(new BigDecimal("20")) > 0) {
                score -= 20;
            } else if (impedance.compareTo(new BigDecimal("15")) > 0) {
                score -= 10;
            }
        }

        if (score >= 80) {
            return HealthStatus.HEALTHY;
        } else if (score >= 50) {
            return HealthStatus.WARNING;
        } else {
            return HealthStatus.CRITICAL;
        }
    }

    @Transactional
    public Kiln updateKilnHealthStatus(Long id) {
        Kiln kiln = getKilnById(id);
        kiln.setHealthStatus(calculateHealthStatus(kiln));
        return kilnRepository.save(kiln);
    }

    public List<MaintenanceOrder> getMaintenanceOrders(Long kilnId) {
        if (kilnId != null) {
            return maintenanceOrderRepository.findByKilnId(kilnId);
        }
        return maintenanceOrderRepository.findAll();
    }

    public MaintenanceOrder getMaintenanceOrderById(Long id) {
        return maintenanceOrderRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("维护工单不存在"));
    }

    @Transactional
    public MaintenanceOrder createMaintenanceOrder(Long kilnId, MaintenanceCreateDTO dto) {
        Kiln kiln = getKilnById(kilnId);

        MaintenanceOrder order = MaintenanceOrder.builder()
                .kilnId(kilnId)
                .kilnName(kiln.getName())
                .type(dto.getType())
                .description(dto.getDescription())
                .status(MaintenanceStatus.PENDING)
                .scheduledDate(dto.getScheduledDate())
                .build();

        MaintenanceOrder savedOrder = maintenanceOrderRepository.save(order);
        notificationService.sendToTopic("/topic/maintenance", Map.of(
                "type", "MAINTENANCE_DUE",
                "kilnId", kilnId,
                "kilnName", kiln.getName(),
                "orderId", savedOrder.getId(),
                "message", "设备维护通知：窑炉 " + kiln.getName() + " 需要维护",
                "timestamp", System.currentTimeMillis()
        ));
        return savedOrder;
    }

    @Transactional
    public MaintenanceOrder startMaintenance(Long id) {
        MaintenanceOrder order = getMaintenanceOrderById(id);
        order.setStatus(MaintenanceStatus.IN_PROGRESS);
        return maintenanceOrderRepository.save(order);
    }

    @Transactional
    public MaintenanceOrder completeMaintenance(Long id) {
        MaintenanceOrder order = getMaintenanceOrderById(id);
        order.setStatus(MaintenanceStatus.COMPLETED);
        order.setCompletedDate(LocalDate.now());

        Kiln kiln = getKilnById(order.getKilnId());
        kiln.setLastMaintenanceDate(LocalDateTime.now());
        kiln.setHealthStatus(HealthStatus.HEALTHY);
        kilnRepository.save(kiln);

        return maintenanceOrderRepository.save(order);
    }

    @Transactional
    public void deleteMaintenanceOrder(Long id) {
        if (!maintenanceOrderRepository.existsById(id)) {
            throw new NotFoundException("维护工单不存在");
        }
        maintenanceOrderRepository.deleteById(id);
    }
}
