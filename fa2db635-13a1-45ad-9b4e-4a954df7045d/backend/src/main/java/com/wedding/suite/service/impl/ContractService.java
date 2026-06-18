package com.wedding.suite.service.impl;

import com.wedding.suite.common.AuthUtil;
import com.wedding.suite.dto.request.ContractDraftRequest;
import com.wedding.suite.dto.request.ContractSignRequest;
import com.wedding.suite.dto.request.ContractUpdateRequest;
import com.wedding.suite.dto.response.SignResultVO;
import com.wedding.suite.entity.ContractClauseEntity;
import com.wedding.suite.entity.ContractEntity;
import com.wedding.suite.entity.PackageEntity;
import com.wedding.suite.entity.WeddingEntity;
import com.wedding.suite.enums.ContractStatus;
import com.wedding.suite.enums.NotificationType;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.ContractRepository;
import com.wedding.suite.repository.PackageRepository;
import com.wedding.suite.repository.WeddingRepository;
import com.wedding.suite.service.NotificationService;
import com.wedding.suite.service.SignService;
import com.wedding.suite.service.SmsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class ContractService {

    private final ContractRepository contractRepo;
    private final WeddingRepository weddingRepo;
    private final PackageRepository packageRepo;
    private final NotificationService notificationService;
    private final SmsService smsService;
    private final SignService signService;

    public ContractService(ContractRepository contractRepo, WeddingRepository weddingRepo,
                           PackageRepository packageRepo, NotificationService notificationService,
                           SmsService smsService, SignService signService) {
        this.contractRepo = contractRepo;
        this.weddingRepo = weddingRepo;
        this.packageRepo = packageRepo;
        this.notificationService = notificationService;
        this.smsService = smsService;
        this.signService = signService;
    }

    public List<ContractEntity> list(String status) {
        if (status != null && !status.isBlank()) {
            return contractRepo.findByStatus(ContractStatus.valueOf(status));
        }
        return contractRepo.findAll();
    }

    public ContractEntity detail(Long id) {
        return get(id);
    }

    @Transactional
    public ContractEntity draft(ContractDraftRequest req) {
        WeddingEntity w = weddingRepo.findById(req.getWeddingId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "婚礼不存在"));
        PackageEntity pkg = packageRepo.findById(req.getPackageId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "套餐不存在"));
        BigDecimal amount = w.getQuoteTotal() != null ? w.getQuoteTotal() : pkg.getBasePrice();
        ContractEntity c = ContractEntity.builder()
                .weddingId(w.getId())
                .coupleName(w.getCoupleName())
                .packageName(pkg.getName())
                .amount(amount)
                .status(ContractStatus.DRAFT)
                .clauses(new java.util.ArrayList<>())
                .build();
        c = contractRepo.save(c);
        String amt = amount.toPlainString();
        addClause(c, "c0", "一、服务内容", "乙方按甲方所选「" + pkg.getName() + "」提供婚礼策划及现场服务。", false, 0);
        addClause(c, "c1", "二、服务费用", "本项目服务总费用为 " + amt + " 元。", false, 1);
        addClause(c, "c2", "三、付款方式", "签订本合同时支付定金 30%，婚礼前 30 日支付尾款 70%。", false, 2);
        addClause(c, "c3", "四、档期约定", "甲方确认婚期后，乙方锁定人员、场地与道具档期。", false, 3);
        addClause(c, "c4", "五、违约责任", "违约方支付合同总额 20% 违约金；不可抗力除外。", false, 4);
        return contractRepo.save(c);
    }

    @Transactional
    public ContractEntity update(Long id, ContractUpdateRequest req) {
        ContractEntity c = get(id);
        c.getClauses().clear();
        contractRepo.save(c);
        int order = 0;
        for (var cl : req.getClauses()) {
            addClause(c, cl.getId() == null ? "c" + order : cl.getId(), cl.getTitle(), cl.getBody(),
                    cl.getIsAddon() != null && cl.getIsAddon(), order);
            order++;
        }
        if (req.getAmount() != null) {
            c.setAmount(req.getAmount());
        }
        if (c.getStatus() == ContractStatus.DRAFT) {
            c.setStatus(ContractStatus.PENDING);
        }
        ContractEntity saved = contractRepo.save(c);
        notifyContractChange(saved, "合同条款已更新");
        return saved;
    }

    @Transactional
    public ContractEntity sign(Long id, ContractSignRequest req) {
        ContractEntity c = get(id);
        WeddingEntity w = weddingRepo.findById(c.getWeddingId()).orElse(null);
        String signer = (req.getSigner() == null || req.getSigner().isBlank())
                ? (w != null ? w.getCoupleName() : "甲方") : req.getSigner();
        if (signService.isEnabled()) {
            SignResultVO result = signService.createSignFlow(id, signer, w != null ? w.getPhone() : null);
            c.setSignUrl(result.getSignUrl());
            c.setFlowId(result.getFlowId());
            c.setSignature(signer);
            c.setStatus(ContractStatus.PENDING);
        } else if (req.getSignature() != null) {
            c.setSignature(req.getSignature());
            c.setStatus(ContractStatus.SIGNED);
            c.setSignedAt(LocalDateTime.now());
        }
        ContractEntity saved = contractRepo.save(c);
        if (saved.getStatus() == ContractStatus.SIGNED) {
            notifyContractChange(saved, "合同已签署");
            sendSms(w, "您的合同已签署，签署人：" + signer);
        } else {
            notifyContractChange(saved, "合同待签署，请前往电子签约平台完成");
        }
        return saved;
    }

    @Transactional
    public ContractEntity voidContract(Long id) {
        ContractEntity c = get(id);
        c.setStatus(ContractStatus.VOID);
        ContractEntity saved = contractRepo.save(c);
        notifyContractChange(saved, "合同已作废");
        return saved;
    }

    @Transactional
    public ContractEntity markSigned(Long id) {
        ContractEntity c = get(id);
        if (c.getStatus() != ContractStatus.SIGNED) {
            c.setStatus(ContractStatus.SIGNED);
            c.setSignedAt(LocalDateTime.now());
            c = contractRepo.save(c);
            WeddingEntity w = weddingRepo.findById(c.getWeddingId()).orElse(null);
            notifyContractChange(c, "合同已签署");
            sendSms(w, "您的合同已签署，签署人：" + (c.getSignature() != null ? c.getSignature() : "甲方"));
        }
        return c;
    }

    private void addClause(ContractEntity c, String key, String title, String body, boolean isAddon, int order) {
        c.getClauses().add(ContractClauseEntity.builder()
                .contractId(c.getId())
                .clauseKey(key)
                .title(title)
                .body(body)
                .isAddon(isAddon)
                .sortOrder(order)
                .build());
    }

    private void notifyContractChange(ContractEntity c, String action) {
        try {
            Long uid = AuthUtil.currentUserId();
            if (uid != null) {
                notificationService.push(uid, action, "合同#" + c.getId() + " " + c.getCoupleName(),
                        NotificationType.WARN, "contract", c.getId());
            }
            notificationService.broadcast(action, "合同#" + c.getId() + " " + c.getCoupleName(), NotificationType.WARN);
        } catch (Exception ignored) {
        }
    }

    private void sendSms(WeddingEntity w, String content) {
        if (w == null || w.getPhone() == null) return;
        try {
            smsService.send(w.getPhone(), Map.of("content", content));
        } catch (Exception ignored) {
        }
    }

    private ContractEntity get(Long id) {
        return contractRepo.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "合同不存在"));
    }
}
