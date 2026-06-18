package com.wedding.suite.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wedding.suite.config.SignProperties;
import com.wedding.suite.dto.response.SignResultVO;
import com.wedding.suite.entity.ContractEntity;
import com.wedding.suite.enums.ContractStatus;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.ContractRepository;
import com.wedding.suite.service.impl.SignServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("SignServiceImpl 电子签名服务单元测试")
class SignServiceImplTest {

    @Mock
    private ContractRepository contractRepo;
    @Mock
    private ExportService exportService;
    @Mock
    private RestTemplate restTemplate;

    private SignServiceImpl signService;

    private SignServiceImpl buildService(String provider, String appId, String appSecret) {
        SignProperties props = new SignProperties();
        props.setProvider(provider);
        props.setEsign(new SignProperties.Esign());
        props.getEsign().setAppId(appId);
        props.getEsign().setAppSecret(appSecret);
        props.getEsign().setBaseUrl("https://smlopenapi.esign.cn");
        SignServiceImpl svc = new SignServiceImpl(props, contractRepo, exportService, new ObjectMapper());
        ReflectionTestUtils.setField(svc, "restTemplate", restTemplate);
        return svc;
    }

    @BeforeEach
    void setUp() {
        signService = buildService("none", "", "");
    }

    @Nested
    @DisplayName("占位模式 (provider=none)")
    class PlaceholderModeTests {

        @Test
        @DisplayName("isEnabled: 未配置时返回 false")
        void isEnabled_notConfigured_returnsFalse() {
            assertFalse(signService.isEnabled());
        }

        @Test
        @DisplayName("createSignFlow: 返回占位 flowId 与链接")
        void createSignFlow_disabled_returnsPlaceholder() {
            ContractEntity c = ContractEntity.builder()
                    .id(5L).weddingId(1L).coupleName("测试新人")
                    .packageName("测试套餐").amount(BigDecimal.TEN)
                    .status(ContractStatus.DRAFT).build();

            when(contractRepo.findById(5L)).thenReturn(Optional.of(c));

            SignResultVO result = signService.createSignFlow(5L, "张三", "13800138000");

            assertNotNull(result);
            assertEquals("flow-5", result.getFlowId());
            assertNotNull(result.getSignUrl());
            assertTrue(result.getSignUrl().contains("/sign/5"));
            assertTrue(result.getMessage().contains("TODO"));
            verifyNoInteractions(restTemplate);
        }

        @Test
        @DisplayName("createSignFlow: 合同不存在时抛出 NOT_FOUND")
        void createSignFlow_noContract_throws() {
            when(contractRepo.findById(999L)).thenReturn(Optional.empty());

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> signService.createSignFlow(999L, "张三", "13800138000"));
            assertEquals(ErrorCode.NOT_FOUND, ex.getErrorCode());
        }

        @Test
        @DisplayName("queryStatus: 占位流程返回 TODO 消息")
        void queryStatus_placeholder_returnsTodo() {
            SignResultVO result = signService.queryStatus("flow-100");
            assertEquals("flow-100", result.getFlowId());
            assertTrue(result.getMessage().contains("TODO"));
        }

        @Test
        @DisplayName("downloadSignedFileUrl: 占位流程返回占位下载链接")
        void downloadSignedFileUrl_placeholder_returnsDownloadUrl() {
            String url = signService.downloadSignedFileUrl("flow-200");
            assertNotNull(url);
            assertTrue(url.contains("/download/flow-200"));
        }
    }

    @Nested
    @DisplayName("真实 e签宝 模式 (provider=esign)")
    class EsignRealModeTests {

        @BeforeEach
        void enableEsign() {
            signService = buildService("esign", "TEST_APP_ID", "TEST_APP_SECRET");
            ReflectionTestUtils.setField(signService, "cachedAccessToken", null);
            ReflectionTestUtils.setField(signService, "tokenExpireTime", 0L);
        }

        @Test
        @DisplayName("isEnabled: 配置后返回 true")
        void isEnabled_configured_returnsTrue() {
            assertTrue(signService.isEnabled());
        }

        @Test
        @DisplayName("getAccessToken: 成功获取并缓存 token")
        void getAccessToken_success_cachesToken() throws Exception {
            String tokenResp = "{\"access_token\":\"TOKEN_12345\",\"expires_in\":7200}";
            when(restTemplate.postForEntity(contains("/oauth2/access_token"), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(tokenResp));

            String token = (String) ReflectionTestUtils.invokeMethod(signService, "getAccessToken");

            assertEquals("TOKEN_12345", token);
            verify(restTemplate, times(1)).postForEntity(contains("/oauth2/access_token"), any(), eq(String.class));
        }

        @Test
        @DisplayName("getAccessToken: token 未过期时使用缓存")
        void getAccessToken_cached_reusesToken() throws Exception {
            String tokenResp = "{\"access_token\":\"CACHED_TOKEN\",\"expires_in\":7200}";
            when(restTemplate.postForEntity(contains("/oauth2/access_token"), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(tokenResp));

            ReflectionTestUtils.invokeMethod(signService, "getAccessToken");
            ReflectionTestUtils.invokeMethod(signService, "getAccessToken");

            verify(restTemplate, times(1)).postForEntity(contains("/oauth2/access_token"), any(), eq(String.class));
        }

        @Test
        @DisplayName("getAccessToken: e签宝返回错误时抛出 SIGN_INIT_FAILED")
        void getAccessToken_error_throwsSignInitFailed() {
            String tokenResp = "{\"code\":1401001,\"msg\":\"参数错误\"}";
            when(restTemplate.postForEntity(contains("/oauth2/access_token"), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(tokenResp));

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> ReflectionTestUtils.invokeMethod(signService, "getAccessToken"));
            assertEquals(ErrorCode.SIGN_INIT_FAILED, ex.getErrorCode());
        }

        @Test
        @DisplayName("queryStatus: 真实 flowId 调用 e签宝 查询接口")
        void queryStatus_realFlowId_callsEsign() throws Exception {
            String tokenResp = "{\"access_token\":\"t\",\"expires_in\":7200}";
            String statusResp = "{\"code\":0,\"data\":{\"signFlowStatus\":2,\"signFlowDescription\":\"已完成\"},\"message\":\"成功\"}";
            when(restTemplate.postForEntity(contains("/oauth2/access_token"), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(tokenResp));
            when(restTemplate.exchange(contains("/sign-flow/"), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(statusResp));

            SignResultVO result = signService.queryStatus("REAL_FLOW_ID");

            assertEquals("REAL_FLOW_ID", result.getFlowId());
            assertEquals("SIGNED", result.getStatus());
            assertEquals("已完成", result.getMessage());
            verify(restTemplate, times(1)).exchange(contains("/sign-flow/"), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));
        }

        @Test
        @DisplayName("downloadSignedFileUrl: 真实 flowId 调用下载地址接口")
        void downloadSignedFileUrl_realFlowId_callsEsign() throws Exception {
            String tokenResp = "{\"access_token\":\"t\",\"expires_in\":7200}";
            String downloadResp = "{\"code\":0,\"data\":{\"downloadUrl\":\"https://esign.cn/files/123.pdf\"},\"message\":\"成功\"}";
            when(restTemplate.postForEntity(contains("/oauth2/access_token"), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(tokenResp));
            when(restTemplate.exchange(contains("/download-url"), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(downloadResp));

            String url = signService.downloadSignedFileUrl("REAL_FLOW_ID");

            assertEquals("https://esign.cn/files/123.pdf", url);
            verify(restTemplate, times(1)).exchange(contains("/download-url"), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));
        }
    }
}
