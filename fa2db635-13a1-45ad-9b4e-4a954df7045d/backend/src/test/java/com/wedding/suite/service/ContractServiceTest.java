package com.wedding.suite.service;

import com.wedding.suite.dto.request.ContractClauseRequest;
import com.wedding.suite.dto.request.ContractDraftRequest;
import com.wedding.suite.dto.request.ContractSignRequest;
import com.wedding.suite.dto.request.ContractUpdateRequest;
import com.wedding.suite.dto.response.SignResultVO;
import com.wedding.suite.entity.ContractEntity;
import com.wedding.suite.entity.PackageEntity;
import com.wedding.suite.entity.WeddingEntity;
import com.wedding.suite.enums.ContractStatus;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.ContractRepository;
import com.wedding.suite.repository.PackageRepository;
import com.wedding.suite.repository.WeddingRepository;
import com.wedding.suite.service.impl.ContractService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ContractService 业务逻辑单元测试")
class ContractServiceTest {

    private static ContractClauseRequest clause(String id, String title, String body, Boolean addon) {
        ContractClauseRequest c = new ContractClauseRequest();
        c.setId(id);
        c.setTitle(title);
        c.setBody(body);
        c.setIsAddon(addon);
        return c;
    }

    @Mock
    private ContractRepository contractRepo;
    @Mock
    private WeddingRepository weddingRepo;
    @Mock
    private PackageRepository packageRepo;
    @Mock
    private NotificationService notificationService;
    @Mock
    private SmsService smsService;
    @Mock
    private SignService signService;

    @InjectMocks
    private ContractService contractService;

    private WeddingEntity wedding;
    private PackageEntity pkg;

    @BeforeEach
    void setUp() {
        wedding = WeddingEntity.builder()
                .id(1L)
                .coupleName("测试新人")
                .phone("13800138000")
                .quoteTotal(new BigDecimal("66666.00"))
                .build();
        pkg = PackageEntity.builder()
                .id(10L)
                .name("测试套餐")
                .basePrice(new BigDecimal("88888.00"))
                .build();
    }

    @Nested
    @DisplayName("合同起草 draft()")
    class DraftTests {

        @Test
        @DisplayName("正常起草：婚礼和套餐存在时返回 DRAFT 状态合同")
        void draft_withValidWeddingAndPackage_returnsDraftContract() {
            ContractDraftRequest req = new ContractDraftRequest();
            req.setWeddingId(1L);
            req.setPackageId(10L);

            when(weddingRepo.findById(1L)).thenReturn(Optional.of(wedding));
            when(packageRepo.findById(10L)).thenReturn(Optional.of(pkg));
            when(contractRepo.save(any(ContractEntity.class))).thenAnswer(inv -> {
                ContractEntity c = inv.getArgument(0);
                c.setId(100L);
                return c;
            });

            ContractEntity result = contractService.draft(req);

            assertNotNull(result);
            assertEquals(ContractStatus.DRAFT, result.getStatus());
            assertEquals("测试新人", result.getCoupleName());
            assertEquals("测试套餐", result.getPackageName());
            assertEquals(new BigDecimal("66666.00"), result.getAmount());
            assertEquals(1L, result.getWeddingId());
            verify(contractRepo, times(2)).save(any());
        }

        @Test
        @DisplayName("起草异常：婚礼不存在时抛出 NOT_FOUND")
        void draft_weddingNotFound_throwsNotFound() {
            ContractDraftRequest req = new ContractDraftRequest();
            req.setWeddingId(999L);
            req.setPackageId(10L);

            when(weddingRepo.findById(999L)).thenReturn(Optional.empty());

            BusinessException ex = assertThrows(BusinessException.class, () -> contractService.draft(req));
            assertEquals(ErrorCode.NOT_FOUND, ex.getErrorCode());
        }

        @Test
        @DisplayName("起草异常：套餐不存在时抛出 NOT_FOUND")
        void draft_packageNotFound_throwsNotFound() {
            ContractDraftRequest req = new ContractDraftRequest();
            req.setWeddingId(1L);
            req.setPackageId(999L);

            when(weddingRepo.findById(1L)).thenReturn(Optional.of(wedding));
            when(packageRepo.findById(999L)).thenReturn(Optional.empty());

            BusinessException ex = assertThrows(BusinessException.class, () -> contractService.draft(req));
            assertEquals(ErrorCode.NOT_FOUND, ex.getErrorCode());
        }

        @Test
        @DisplayName("起草金额：婚礼报价为空时使用套餐底价")
        void draft_noQuote_usesPackageBasePrice() {
            wedding.setQuoteTotal(null);
            ContractDraftRequest req = new ContractDraftRequest();
            req.setWeddingId(1L);
            req.setPackageId(10L);

            when(weddingRepo.findById(1L)).thenReturn(Optional.of(wedding));
            when(packageRepo.findById(10L)).thenReturn(Optional.of(pkg));
            when(contractRepo.save(any(ContractEntity.class))).thenAnswer(inv -> {
                ContractEntity c = inv.getArgument(0);
                c.setId(100L);
                return c;
            });

            ContractEntity result = contractService.draft(req);
            assertEquals(new BigDecimal("88888.00"), result.getAmount());
        }

        @Test
        @DisplayName("起草内容：合同自动包含 5 条默认条款")
        void draft_createsFiveDefaultClauses() {
            ContractDraftRequest req = new ContractDraftRequest();
            req.setWeddingId(1L);
            req.setPackageId(10L);

            when(weddingRepo.findById(1L)).thenReturn(Optional.of(wedding));
            when(packageRepo.findById(10L)).thenReturn(Optional.of(pkg));
            when(contractRepo.save(any(ContractEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            ContractEntity result = contractService.draft(req);
            assertEquals(5, result.getClauses().size());
        }
    }

    @Nested
    @DisplayName("合同签署 sign()")
    class SignTests {

        private ContractEntity contract;

        @BeforeEach
        void setUp() {
            contract = ContractEntity.builder()
                    .id(100L)
                    .weddingId(1L)
                    .coupleName("测试新人")
                    .packageName("测试套餐")
                    .amount(new BigDecimal("66666"))
                    .status(ContractStatus.DRAFT)
                    .clauses(new ArrayList<>())
                    .build();
        }

        @Test
        @DisplayName("签署流程：服务未启用且上传签名时状态为 SIGNED")
        void sign_disabledWithSignature_marksSigned() {
            ContractSignRequest req = new ContractSignRequest();
            req.setSigner("张三");
            req.setSignerPhone("13800138000");
            req.setSignature("handwritten-signature-data");

            when(contractRepo.findById(100L)).thenReturn(Optional.of(contract));
            when(weddingRepo.findById(1L)).thenReturn(Optional.of(wedding));
            when(signService.isEnabled()).thenReturn(false);
            when(signService.createSignFlow(100L, "张三", "13800138000"))
                    .thenReturn(new SignResultVO("flow-100", "http://mock/sign", "MANUAL", "mock"));
            when(contractRepo.save(any(ContractEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            ContractEntity result = contractService.sign(100L, req);

            assertEquals(ContractStatus.SIGNED, result.getStatus());
            assertEquals("张三", result.getSignature());
            assertNotNull(result.getSignedAt());
            verify(notificationService, atLeastOnce()).broadcast(any(), any(), any());
            verify(smsService, times(1)).send(eq("13800138000"), any());
        }

        @Test
        @DisplayName("签署流程：服务未启用且无签名时状态为 PENDING")
        void sign_disabledNoSignature_marksPending() {
            ContractSignRequest req = new ContractSignRequest();
            req.setSigner("张三");
            req.setSignerPhone("13800138000");

            when(contractRepo.findById(100L)).thenReturn(Optional.of(contract));
            when(weddingRepo.findById(1L)).thenReturn(Optional.of(wedding));
            when(signService.isEnabled()).thenReturn(false);
            when(signService.createSignFlow(100L, "张三", "13800138000"))
                    .thenReturn(new SignResultVO("flow-100", "http://mock/sign", "MANUAL", "mock"));
            when(contractRepo.save(any(ContractEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            ContractEntity result = contractService.sign(100L, req);
            assertEquals(ContractStatus.PENDING, result.getStatus());
            assertNull(result.getSignedAt());
            verify(smsService, never()).send(any(), any());
        }

        @Test
        @DisplayName("签署流程：服务启用时状态为 PENDING 并记录 flowId/signUrl")
        void sign_enabled_marksPendingWithFlow() {
            ContractSignRequest req = new ContractSignRequest();
            req.setSigner("张三");
            req.setSignerPhone("13800138000");

            when(contractRepo.findById(100L)).thenReturn(Optional.of(contract));
            when(weddingRepo.findById(1L)).thenReturn(Optional.of(wedding));
            when(signService.isEnabled()).thenReturn(true);
            when(signService.createSignFlow(100L, "张三", "13800138000"))
                    .thenReturn(new SignResultVO("esign-real-flow-123", "https://esign.cn/sign/xxx", "PENDING", "ok"));
            when(contractRepo.save(any(ContractEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            ContractEntity result = contractService.sign(100L, req);

            assertEquals(ContractStatus.PENDING, result.getStatus());
            assertEquals("esign-real-flow-123", result.getFlowId());
            assertEquals("https://esign.cn/sign/xxx", result.getSignUrl());
        }

        @Test
        @DisplayName("签署异常：合同不存在时抛出 NOT_FOUND")
        void sign_contractNotFound_throwsNotFound() {
            ContractSignRequest req = new ContractSignRequest();
            req.setSigner("张三");
            req.setSignerPhone("13800138000");

            when(contractRepo.findById(999L)).thenReturn(Optional.empty());

            BusinessException ex = assertThrows(BusinessException.class, () -> contractService.sign(999L, req));
            assertEquals(ErrorCode.NOT_FOUND, ex.getErrorCode());
        }

        @Test
        @DisplayName("签署人：未指定时使用婚礼新人名和电话")
        void sign_noSigner_usesWeddingInfo() {
            ContractSignRequest req = new ContractSignRequest();
            req.setSigner("");
            req.setSignerPhone("");

            when(contractRepo.findById(100L)).thenReturn(Optional.of(contract));
            when(weddingRepo.findById(1L)).thenReturn(Optional.of(wedding));
            when(signService.isEnabled()).thenReturn(false);
            when(signService.createSignFlow(eq(100L), any(), any()))
                    .thenAnswer(inv -> new SignResultVO("flow-100", "url", "M", "mock"));
            when(contractRepo.save(any(ContractEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            contractService.sign(100L, req);

            @SuppressWarnings("unchecked")
            ArgumentCaptor<String> nameCaptor = ArgumentCaptor.forClass(String.class);
            verify(signService).createSignFlow(eq(100L), nameCaptor.capture(), any());
            assertEquals("测试新人", nameCaptor.getValue());
        }
    }

    @Nested
    @DisplayName("合同状态流转（状态机）")
    class StateTransitionTests {

        @Test
        @DisplayName("状态流转：DRAFT →(更新)→ PENDING")
        void update_draftToPending() {
            ContractEntity c = ContractEntity.builder()
                    .id(100L).weddingId(1L).coupleName("测试")
                    .packageName("测试").amount(BigDecimal.TEN)
                    .status(ContractStatus.DRAFT).clauses(new ArrayList<>()).build();

            ContractUpdateRequest req = new ContractUpdateRequest();
            req.setAmount(new BigDecimal("9999"));
            req.setClauses(List.of(clause("c0", "title", "body", false)));

            when(contractRepo.findById(100L)).thenReturn(Optional.of(c));
            when(contractRepo.save(any(ContractEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            ContractEntity result = contractService.update(100L, req);
            assertEquals(ContractStatus.PENDING, result.getStatus());
        }

        @Test
        @DisplayName("状态流转：PENDING →(更新)→ 仍保持 PENDING")
        void update_pendingStaysPending() {
            ContractEntity c = ContractEntity.builder()
                    .id(100L).weddingId(1L).coupleName("测试")
                    .packageName("测试").amount(BigDecimal.TEN)
                    .status(ContractStatus.PENDING).clauses(new ArrayList<>()).build();

            ContractUpdateRequest req = new ContractUpdateRequest();
            req.setClauses(List.of(clause("c0", "t", "b", false)));

            when(contractRepo.findById(100L)).thenReturn(Optional.of(c));
            when(contractRepo.save(any(ContractEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            ContractEntity result = contractService.update(100L, req);
            assertEquals(ContractStatus.PENDING, result.getStatus());
        }

        @Test
        @DisplayName("状态流转：DRAFT →(作废)→ VOID")
        void voidContract_draftToVoid() {
            ContractEntity c = ContractEntity.builder()
                    .id(100L).weddingId(1L).coupleName("测试")
                    .packageName("测试").amount(BigDecimal.TEN)
                    .status(ContractStatus.DRAFT).clauses(new ArrayList<>()).build();

            when(contractRepo.findById(100L)).thenReturn(Optional.of(c));
            when(contractRepo.save(any(ContractEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            ContractEntity result = contractService.voidContract(100L);
            assertEquals(ContractStatus.VOID, result.getStatus());
        }

        @Test
        @DisplayName("状态流转：SIGNED →(作废)→ VOID")
        void voidContract_signedToVoid() {
            ContractEntity c = ContractEntity.builder()
                    .id(100L).status(ContractStatus.SIGNED).clauses(new ArrayList<>()).build();

            when(contractRepo.findById(100L)).thenReturn(Optional.of(c));
            when(contractRepo.save(any(ContractEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            ContractEntity result = contractService.voidContract(100L);
            assertEquals(ContractStatus.VOID, result.getStatus());
        }

        @Test
        @DisplayName("状态流转：PENDING →(markSigned)→ SIGNED")
        void markSigned_pendingToSigned() {
            ContractEntity c = ContractEntity.builder()
                    .id(100L).weddingId(1L).signature("张三")
                    .status(ContractStatus.PENDING).clauses(new ArrayList<>()).build();

            when(contractRepo.findById(100L)).thenReturn(Optional.of(c));
            when(contractRepo.save(any(ContractEntity.class))).thenAnswer(inv -> inv.getArgument(0));
            when(weddingRepo.findById(1L)).thenReturn(Optional.of(wedding));

            ContractEntity result = contractService.markSigned(100L);
            assertEquals(ContractStatus.SIGNED, result.getStatus());
            assertNotNull(result.getSignedAt());
        }

        @Test
        @DisplayName("状态流转：已 SIGNED 的合同 markSigned 保持不变")
        void markSigned_alreadySigned_noChange() {
            ContractEntity c = ContractEntity.builder()
                    .id(100L).status(ContractStatus.SIGNED)
                    .clauses(new ArrayList<>()).build();

            when(contractRepo.findById(100L)).thenReturn(Optional.of(c));

            ContractEntity result = contractService.markSigned(100L);
            verify(contractRepo, never()).save(any());
            assertEquals(ContractStatus.SIGNED, result.getStatus());
        }
    }

    @Nested
    @DisplayName("合同列表与详情")
    class ListAndDetailTests {

        @Test
        @DisplayName("list：过滤状态参数")
        void list_withStatus_filterByStatus() {
            List<ContractEntity> signedList = List.of(ContractEntity.builder()
                    .id(1L).status(ContractStatus.SIGNED).build());
            when(contractRepo.findByStatus(ContractStatus.SIGNED)).thenReturn(signedList);

            List<ContractEntity> result = contractService.list("SIGNED");
            assertEquals(1, result.size());
            verify(contractRepo, times(1)).findByStatus(ContractStatus.SIGNED);
        }

        @Test
        @DisplayName("list：无状态参数返回全部")
        void list_noStatus_returnAll() {
            when(contractRepo.findAll()).thenReturn(List.of());
            contractService.list(null);
            verify(contractRepo, times(1)).findAll();
        }

        @Test
        @DisplayName("detail：合同不存在抛出 NOT_FOUND")
        void detail_notFound_throws() {
            when(contractRepo.findById(999L)).thenReturn(Optional.empty());
            BusinessException ex = assertThrows(BusinessException.class, () -> contractService.detail(999L));
            assertEquals(ErrorCode.NOT_FOUND, ex.getErrorCode());
        }
    }
}
