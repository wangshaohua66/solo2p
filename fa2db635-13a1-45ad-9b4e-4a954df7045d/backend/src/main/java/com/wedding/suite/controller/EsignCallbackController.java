package com.wedding.suite.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wedding.suite.config.SignProperties;
import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.entity.ContractEntity;
import com.wedding.suite.entity.WeddingEntity;
import com.wedding.suite.enums.ContractStatus;
import com.wedding.suite.enums.NotificationType;
import com.wedding.suite.repository.ContractRepository;
import com.wedding.suite.repository.WeddingRepository;
import com.wedding.suite.service.NotificationService;
import com.wedding.suite.service.SignService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/esign")
public class EsignCallbackController {

    private static final Logger log = LoggerFactory.getLogger(EsignCallbackController.class);

    private final SignService signService;
    private final ContractRepository contractRepo;
    private final WeddingRepository weddingRepo;
    private final NotificationService notificationService;
    private final SignProperties signProps;
    private final ObjectMapper objectMapper;

    public EsignCallbackController(SignService signService, ContractRepository contractRepo,
                                   WeddingRepository weddingRepo, NotificationService notificationService,
                                   SignProperties signProps, ObjectMapper objectMapper) {
        this.signService = signService;
        this.contractRepo = contractRepo;
        this.weddingRepo = weddingRepo;
        this.notificationService = notificationService;
        this.signProps = signProps;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/callback")
    public ApiResponse<String> handleCallback(HttpServletRequest request) {
        try {
            String body = request.getReader().lines().collect(Collectors.joining("\n"));
            log.info("[e签宝回调] 收到回调请求 body={}", body);

            JsonNode payload = objectMapper.readTree(body);
            String signFlowId = payload.path("signFlowId").asText();
            String status = payload.path("signFlowStatus").asText();

            String signature = request.getHeader("X-Tsign-Signature");
            if (signService.isEnabled()) {
                boolean valid = verifySignature(signature, body, signProps.getEsign().getAppSecret());
                if (!valid) {
                    log.warn("[e签宝回调] 签名验证失败 signFlowId={}", signFlowId);
                    return ApiResponse.ok("签名验证失败");
                }
            } else {
                log.info("[e签宝回调] 电子签名服务未启用，跳过签名验证");
            }

            ContractEntity contract = contractRepo.findByFlowId(signFlowId).orElse(null);
            if (contract == null) {
                log.warn("[e签宝回调] 未找到对应合同 signFlowId={}", signFlowId);
                return ApiResponse.ok("合同未找到");
            }

            WeddingEntity wedding = weddingRepo.findById(contract.getWeddingId()).orElse(null);
            Long plannerId = (wedding != null && wedding.getPlannerId() != null)
                    ? wedding.getPlannerId() : 0L;

            String statusDesc = switch (status) {
                case "2" -> {
                    contract.setStatus(ContractStatus.SIGNED);
                    contractRepo.save(contract);
                    notificationService.push(
                            plannerId,
                            "合同签署完成",
                            "合同 #" + contract.getId() + " 已完成签署",
                            NotificationType.SUCCESS,
                            "CONTRACT",
                            contract.getId()
                    );
                    yield "已完成";
                }
                case "3" -> {
                    contract.setStatus(ContractStatus.VOID);
                    contractRepo.save(contract);
                    notificationService.push(
                            plannerId,
                            "合同已作废",
                            "合同 #" + contract.getId() + " 已作废",
                            NotificationType.WARN,
                            "CONTRACT",
                            contract.getId()
                    );
                    yield "已作废";
                }
                case "5" -> {
                    contract.setStatus(ContractStatus.DRAFT);
                    contractRepo.save(contract);
                    notificationService.push(
                            plannerId,
                            "合同被拒签",
                            "合同 #" + contract.getId() + " 被签署人拒签",
                            NotificationType.WARN,
                            "CONTRACT",
                            contract.getId()
                    );
                    yield "已拒签";
                }
                default -> "状态: " + status;
            };

            log.info("[e签宝回调] 处理完成 signFlowId={}, contractId={}, status={}",
                    signFlowId, contract.getId(), statusDesc);
            return ApiResponse.ok("success");

        } catch (Exception e) {
            log.error("[e签宝回调] 处理异常", e);
            return ApiResponse.ok("error");
        }
    }

    private boolean verifySignature(String signature, String body, String secret) {
        try {
            // TODO: e签宝回调签名验证逻辑需根据官方文档调整。当前使用 SHA256(body + secret) 的简化方式，生产环境请根据官方文档修正
            String content = body + secret;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(content.getBytes(StandardCharsets.UTF_8));
            String computed = Base64.getEncoder().encodeToString(digest);
            return computed.equals(signature);
        } catch (Exception e) {
            log.error("[e签宝回调] 签名验证异常", e);
            return false;
        }
    }
}
