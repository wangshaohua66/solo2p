package com.glassstudio.service;

import com.glassstudio.dto.BatchCreateDTO;
import com.glassstudio.dto.FifoCheckoutResult;
import com.glassstudio.entity.Batch;
import com.glassstudio.entity.BatchStatus;
import com.glassstudio.exception.NotFoundException;
import com.glassstudio.exception.ValidationException;
import com.glassstudio.mapper.BatchMapper;
import com.glassstudio.repository.BatchRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final BatchRepository batchRepository;
    private final BatchMapper batchMapper;
    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;

    public List<Batch> getAllBatches() {
        return batchRepository.findAll();
    }

    public Batch getBatchById(Long id) {
        return batchRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("批次不存在"));
    }

    public List<Batch> getExpiryWarnings() {
        LocalDate warningDate = LocalDate.now().plusDays(30);
        List<Batch> batches = batchRepository.findByStatusAndExpiryDateBefore(BatchStatus.IN_STOCK, warningDate);
        if (!batches.isEmpty()) {
            notificationService.sendInventoryAlert("库存过期预警：有 " + batches.size() + " 个批次即将过期");
        }
        return batches;
    }

    @Transactional
    public Batch createBatch(BatchCreateDTO dto) {
        Batch batch = batchMapper.toEntity(dto);
        batch.setStatus(BatchStatus.IN_STOCK);
        batch.setUnitPrice(dto.getUnitPrice());

        if (dto.getOxideComposition() != null) {
            try {
                batch.setOxideComposition(objectMapper.writeValueAsString(dto.getOxideComposition()));
            } catch (JsonProcessingException e) {
                throw new ValidationException("氧化物成分数据格式错误");
            }
        }

        return batchRepository.save(batch);
    }

    @Transactional
    public Batch checkoutBatch(Long id, BigDecimal quantity) {
        Batch batch = getBatchById(id);

        if (batch.getStatus() != BatchStatus.IN_STOCK) {
            throw new ValidationException("批次不在库存状态");
        }

        if (batch.getQuantity().compareTo(quantity) < 0) {
            throw new ValidationException("库存不足");
        }

        BigDecimal remaining = batch.getQuantity().subtract(quantity);
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
            batch.setStatus(BatchStatus.CHECKED_OUT);
            batch.setQuantity(BigDecimal.ZERO);
        } else {
            batch.setQuantity(remaining);
        }

        Batch savedBatch = batchRepository.save(batch);

        if (savedBatch.getStatus() == BatchStatus.IN_STOCK &&
                savedBatch.getQuantity().compareTo(new BigDecimal("10")) <= 0) {
            notificationService.sendInventoryAlert("库存不足告警：物料 " + savedBatch.getMaterialName() + " 库存仅剩 " + savedBatch.getQuantity());
        }

        return savedBatch;
    }

    @Transactional
    public Batch fifoCheckout(String materialName, BigDecimal quantity) {
        Batch batch = batchRepository.findTopByMaterialNameAndStatusOrderByCreatedAtAsc(materialName, BatchStatus.IN_STOCK);
        if (batch == null) {
            throw new NotFoundException("没有可用的库存批次");
        }
        return checkoutBatch(batch.getId(), quantity);
    }

    @Transactional
    public FifoCheckoutResult fifoCheckoutBatches(String materialName, BigDecimal quantity) {
        List<Batch> batches = batchRepository.findByMaterialNameAndStatusOrderByCreatedAtAsc(
                materialName, BatchStatus.IN_STOCK);

        if (batches.isEmpty()) {
            throw new NotFoundException("没有可用的库存批次");
        }

        BigDecimal totalAvailable = batches.stream()
                .map(Batch::getQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalAvailable.compareTo(quantity) < 0) {
            throw new ValidationException("库存不足，可用: " + totalAvailable);
        }

        BigDecimal remaining = quantity;
        BigDecimal totalCost = BigDecimal.ZERO;
        List<FifoCheckoutResult.BatchCheckoutItem> items = new java.util.ArrayList<>();

        for (Batch batch : batches) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
                break;
            }

            BigDecimal takeQty = remaining.min(batch.getQuantity());
            BigDecimal unitPrice = batch.getUnitPrice() != null ? batch.getUnitPrice() : BigDecimal.ZERO;
            BigDecimal subtotal = takeQty.multiply(unitPrice).setScale(2, RoundingMode.HALF_UP);

            BigDecimal leftInBatch = batch.getQuantity().subtract(takeQty);
            if (leftInBatch.compareTo(BigDecimal.ZERO) <= 0) {
                batch.setQuantity(BigDecimal.ZERO);
                batch.setStatus(BatchStatus.CHECKED_OUT);
            } else {
                batch.setQuantity(leftInBatch);
            }
            batchRepository.save(batch);

            items.add(FifoCheckoutResult.BatchCheckoutItem.builder()
                    .batchId(batch.getId())
                    .batchNo(batch.getBatchNo())
                    .quantity(takeQty)
                    .unitPrice(unitPrice)
                    .subtotal(subtotal)
                    .build());

            totalCost = totalCost.add(subtotal);
            remaining = remaining.subtract(takeQty);
        }

        if (items.size() > 0) {
            Batch lastBatch = batchRepository.findById(items.get(items.size() - 1).getBatchId()).orElse(null);
            if (lastBatch != null && lastBatch.getStatus() == BatchStatus.IN_STOCK &&
                    lastBatch.getQuantity().compareTo(new BigDecimal("10")) <= 0) {
                notificationService.sendInventoryAlert(
                        "库存不足告警：物料 " + lastBatch.getMaterialName() + " 库存仅剩 " + lastBatch.getQuantity());
            }
        }

        return FifoCheckoutResult.builder()
                .materialName(materialName)
                .totalQuantity(quantity)
                .totalCost(totalCost)
                .items(items)
                .build();
    }

    @Transactional
    public void deleteBatch(Long id) {
        if (!batchRepository.existsById(id)) {
            throw new NotFoundException("批次不存在");
        }
        batchRepository.deleteById(id);
    }

    public Map<String, Object> getOxideComposition(Long id) {
        Batch batch = getBatchById(id);
        if (batch.getOxideComposition() == null) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(batch.getOxideComposition(), Map.class);
        } catch (JsonProcessingException e) {
            throw new ValidationException("氧化物成分数据解析失败");
        }
    }
}
