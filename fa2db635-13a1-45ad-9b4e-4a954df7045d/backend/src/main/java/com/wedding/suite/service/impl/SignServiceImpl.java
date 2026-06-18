package com.wedding.suite.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wedding.suite.config.SignProperties;
import com.wedding.suite.dto.response.SignResultVO;
import com.wedding.suite.entity.ContractEntity;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.ContractRepository;
import com.wedding.suite.service.ExportService;
import com.wedding.suite.service.SignService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class SignServiceImpl implements SignService {

    private static final Logger log = LoggerFactory.getLogger(SignServiceImpl.class);

    private final SignProperties props;
    private final ContractRepository contractRepo;
    private final ExportService exportService;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    private String cachedAccessToken;
    private long tokenExpireTime;

    public SignServiceImpl(SignProperties props, ContractRepository contractRepo,
                           ExportService exportService, ObjectMapper objectMapper) {
        this.props = props;
        this.contractRepo = contractRepo;
        this.exportService = exportService;
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
    }

    @Override
    public boolean isEnabled() {
        return props.getProvider() != null && !"none".equalsIgnoreCase(props.getProvider())
                && props.getEsign().getAppId() != null && !props.getEsign().getAppId().isEmpty()
                && props.getEsign().getAppSecret() != null && !props.getEsign().getAppSecret().isEmpty();
    }

    private synchronized String getAccessToken() {
        if (cachedAccessToken != null && System.currentTimeMillis() < tokenExpireTime) {
            return cachedAccessToken;
        }
        if (!isEnabled()) {
            throw new BusinessException(ErrorCode.SIGN_INIT_FAILED, "电子签名服务未配置 appId/appSecret");
        }

        try {
            String url = props.getEsign().getBaseUrl() + "/v1/oauth2/access_token";
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("grant_type", "client_credentials");
            params.add("app_id", props.getEsign().getAppId());
            params.add("app_secret", props.getEsign().getAppSecret());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            JsonNode body = objectMapper.readTree(response.getBody());

            if (body.has("access_token")) {
                cachedAccessToken = body.get("access_token").asText();
                int expiresIn = body.path("expires_in").asInt(7200);
                tokenExpireTime = System.currentTimeMillis() + (expiresIn - 300) * 1000L;
                log.info("[e签宝] 获取 access_token 成功，有效期 {} 秒", expiresIn);
                return cachedAccessToken;
            } else {
                throw new BusinessException(ErrorCode.SIGN_INIT_FAILED,
                        "获取 access_token 失败: " + body.path("msg").asText("未知错误"));
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("[e签宝] 获取 access_token 异常", e);
            throw new BusinessException(ErrorCode.SIGN_INIT_FAILED, "获取 access_token 失败: " + e.getMessage());
        }
    }

    @Override
    public SignResultVO createSignFlow(Long contractId, String signerName, String signerPhone) {
        ContractEntity c = contractRepo.findById(contractId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "合同不存在"));

        if (!isEnabled()) {
            String url = props.getEsign().getBaseUrl() + "/sign/" + contractId;
            log.info("[Sign disabled] 合同#{} 生成占位签署链接", contractId);
            return new SignResultVO("flow-" + contractId, url, "MANUAL",
                    "TODO: 未配置电子签名服务，当前返回占位链接，请在 application.yml 中配置 wedding.sign.esign.app-id 和 app-secret 后启用真实签署流程");
        }

        try {
            byte[] pdfContent = exportService.exportContractPdf(contractId);
            String fileMd5 = computeMD5(pdfContent);

            String fileKey = uploadFile(pdfContent, fileMd5, "合同-" + contractId + ".pdf");
            String flowId = createSignFlowByFile(fileKey, fileMd5, contractId, signerName, signerPhone);
            String signUrl = getSignUrl(flowId, signerName, signerPhone);

            log.info("[e签宝] 合同#{} 创建签署流程成功 flowId={}", contractId, flowId);
            return new SignResultVO(flowId, signUrl, "PENDING",
                    "已发起电子签署流程，请签署人点击链接完成签署：" + signerName + "(" + signerPhone + ")");
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("[e签宝] 合同#{} 创建签署流程异常", contractId, e);
            throw new BusinessException(ErrorCode.SIGN_INIT_FAILED, "电子签名发起失败: " + e.getMessage());
        }
    }

    private String uploadFile(byte[] fileContent, String fileMd5, String fileName) throws Exception {
        String token = getAccessToken();
        String url = props.getEsign().getBaseUrl() + "/v2/files/get-upload-url";

        Map<String, Object> body = new HashMap<>();
        body.put("contentMd5", fileMd5);
        body.put("contentType", "application/pdf");
        body.put("fileName", fileName);
        body.put("fileSize", fileContent.length);
        body.put("convert2Pdf", false);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Tsign-Open-App-Id", props.getEsign().getAppId());
        headers.set("X-Tsign-Open-Token", token);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
        JsonNode resp = objectMapper.readTree(response.getBody());

        if (!resp.path("code").asText().equals("0")) {
            throw new BusinessException(ErrorCode.SIGN_INIT_FAILED,
                    "获取文件上传地址失败: " + resp.path("message").asText("未知错误"));
        }

        String uploadUrl = resp.path("data").path("uploadUrl").asText();
        String fileKey = resp.path("data").path("fileKey").asText();

        HttpHeaders uploadHeaders = new HttpHeaders();
        uploadHeaders.setContentType(MediaType.APPLICATION_PDF);
        uploadHeaders.set("Content-MD5", fileMd5);
        HttpEntity<byte[]> uploadRequest = new HttpEntity<>(fileContent, uploadHeaders);
        restTemplate.put(uploadUrl, uploadRequest);

        log.info("[e签宝] 文件上传成功 fileKey={}, size={}", fileKey, fileContent.length);
        return fileKey;
    }

    private String createSignFlowByFile(String fileKey, String fileMd5, Long contractId,
                                         String signerName, String signerPhone) throws Exception {
        String token = getAccessToken();
        String url = props.getEsign().getBaseUrl() + "/v3/sign-flow/create-by-file";

        Map<String, Object> doc = new HashMap<>();
        doc.put("fileId", fileKey);
        doc.put("fileName", "合同-" + contractId + ".pdf");
        doc.put("fileMd5", fileMd5);
        doc.put("encryption", "");

        Map<String, Object> signer = new HashMap<>();
        signer.put("signerType", 1);
        signer.put("signerAccountName", signerName);

        Map<String, Object> signField = new HashMap<>();
        signField.put("fileId", fileKey);
        signField.put("signerType", 1);
        signField.put("signerAccountName", signerName);
        signField.put("mobile", signerPhone);

        Map<String, Object> normalSignField = new HashMap<>();
        normalSignField.put("movable", false);
        normalSignField.put("signFieldType", 2);

        Map<String, Object> posBean = new HashMap<>();
        posBean.put("posPage", "1");
        posBean.put("posX", 400.0);
        posBean.put("posY", 150.0);
        posBean.put("width", 150.0);
        normalSignField.put("posBean", posBean);
        signField.put("normalSignField", normalSignField);
        signer.put("signFields", new Map[]{signField});

        Map<String, Object> body = new HashMap<>();
        body.put("docs", new Map[]{doc});
        body.put("signers", new Map[]{signer});
        body.put("autoSign", false);
        body.put("signFlowConfig", Map.of(
                "signFlowTitle", "婚礼服务合同签署",
                "notifyDeveloperUrl", "/api/esign/callback"
        ));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Tsign-Open-App-Id", props.getEsign().getAppId());
        headers.set("X-Tsign-Open-Token", token);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
        JsonNode resp = objectMapper.readTree(response.getBody());

        if (!resp.path("code").asText().equals("0")) {
            throw new BusinessException(ErrorCode.SIGN_INIT_FAILED,
                    "创建签署流程失败: " + resp.path("message").asText("未知错误"));
        }

        String flowId = resp.path("data").path("signFlowId").asText();

        String startUrl = props.getEsign().getBaseUrl() + "/v3/sign-flow/" + flowId + "/start";
        HttpEntity<Void> startRequest = new HttpEntity<>(headers);
        restTemplate.postForEntity(startUrl, startRequest, String.class);
        log.info("[e签宝] 签署流程已启动 flowId={}", flowId);

        return flowId;
    }

    private String getSignUrl(String flowId, String signerName, String signerPhone) throws Exception {
        String token = getAccessToken();
        String url = props.getEsign().getBaseUrl() + "/v3/sign-flow/" + flowId + "/sign-urls";

        Map<String, Object> body = new HashMap<>();
        body.put("needLogin", false);
        body.put("signerAccountName", signerName);
        body.put("signerMobile", signerPhone);
        body.put("flowId", flowId);
        body.put("appScheme", "");
        body.put("urlType", "");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Tsign-Open-App-Id", props.getEsign().getAppId());
        headers.set("X-Tsign-Open-Token", token);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
        JsonNode resp = objectMapper.readTree(response.getBody());

        if (!resp.path("code").asText().equals("0")) {
            throw new BusinessException(ErrorCode.SIGN_INIT_FAILED,
                    "获取签署链接失败: " + resp.path("message").asText("未知错误"));
        }

        return resp.path("data").path("url").asText();
    }

    @Override
    public SignResultVO queryStatus(String flowId) {
        if (flowId.startsWith("flow-")) {
            return new SignResultVO(flowId, null, "PENDING",
                    "TODO: 占位签署流程无真实状态查询，请配置电子签名服务后使用真实 flowId");
        }

        try {
            String token = getAccessToken();
            String url = props.getEsign().getBaseUrl() + "/v3/sign-flow/" + flowId;

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Tsign-Open-App-Id", props.getEsign().getAppId());
            headers.set("X-Tsign-Open-Token", token);
            HttpEntity<Void> request = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
            JsonNode resp = objectMapper.readTree(response.getBody());

            if (!resp.path("code").asText().equals("0")) {
                throw new BusinessException(ErrorCode.SIGN_INIT_FAILED,
                        "查询签署状态失败: " + resp.path("message").asText("未知错误"));
            }

            String status = resp.path("data").path("signFlowStatus").asText();
            String statusDesc = switch (status) {
                case "0" -> "草稿";
                case "1" -> "签署中";
                case "2" -> "已完成";
                case "3" -> "已作废";
                case "4" -> "已过期";
                case "5" -> "已拒签";
                default -> "未知状态";
            };

            String statusCode = "2".equals(status) ? "SIGNED" : "PENDING";
            return new SignResultVO(flowId, null, statusCode, statusDesc);

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("[e签宝] 查询签署状态异常 flowId={}", flowId, e);
            throw new BusinessException(ErrorCode.SIGN_INIT_FAILED, "查询签署状态失败: " + e.getMessage());
        }
    }

    @Override
    public String downloadSignedFileUrl(String flowId) {
        if (flowId.startsWith("flow-")) {
            // TODO: 未配置电子签名服务，当前返回占位下载链接，请配置电子签名服务后使用真实 flowId
            return props.getEsign().getBaseUrl() + "/download/" + flowId;
        }

        try {
            String token = getAccessToken();
            String url = props.getEsign().getBaseUrl() + "/v3/sign-flow/" + flowId + "/download-url";

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Tsign-Open-App-Id", props.getEsign().getAppId());
            headers.set("X-Tsign-Open-Token", token);
            HttpEntity<Void> request = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
            JsonNode resp = objectMapper.readTree(response.getBody());

            if (!resp.path("code").asText().equals("0")) {
                throw new BusinessException(ErrorCode.SIGN_INIT_FAILED,
                        "获取签署文件下载地址失败: " + resp.path("message").asText("未知错误"));
            }

            return resp.path("data").path("downloadUrl").asText();

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("[e签宝] 获取下载地址异常 flowId={}", flowId, e);
            throw new BusinessException(ErrorCode.SIGN_INIT_FAILED, "获取下载地址失败: " + e.getMessage());
        }
    }

    private String computeMD5(byte[] content) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] digest = md.digest(content);
        return Base64.getEncoder().encodeToString(digest);
    }
}
