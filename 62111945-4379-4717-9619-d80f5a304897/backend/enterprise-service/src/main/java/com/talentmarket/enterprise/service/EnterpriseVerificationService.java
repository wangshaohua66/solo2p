package com.talentmarket.enterprise.service;

import cn.hutool.core.util.IdcardUtil;
import cn.hutool.core.util.ReUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class EnterpriseVerificationService {

    private final StringRedisTemplate stringRedisTemplate;

    @Value("${verification.mock:false}")
    private boolean mockMode;

    @Value("${verification.api.host:https://dm-232.data.aliyun.com}")
    private String apiHost;

    @Value("${verification.api.path:/rest/160601/odps/[阿里云市场API路径]}")
    private String apiPath;

    @Value("${verification.api.app-code:}")
    private String appCode;

    @Value("${verification.api.connect-timeout:5000}")
    private int connectTimeout;

    @Value("${verification.api.read-timeout:10000}")
    private int readTimeout;

    @Value("${verification.cache-hours:24}")
    private int cacheHours;

    private static final String CREDIT_CODE_PATTERN = "^[0-9A-HJ-NPQRTUWXY]{2}\\d{6}[0-9A-HJ-NPQRTUWXY]{10}$";
    private static final String CACHE_PREFIX = "verification:enterprise:";
    private static final String RATE_LIMIT_PREFIX = "verification:rate:";
    private static final int MAX_REQUESTS_PER_MINUTE = 30;
    private static final int MAX_RETRY_COUNT = 2;

    public VerificationResult verifyEnterprise(String enterpriseName, String unifiedSocialCreditCode,
                                               String legalPerson, String businessLicenseUrl) {
        log.info("开始企业资质审核，企业名称: {}, 统一社会信用代码: {}, 法人: {}", 
                enterpriseName, unifiedSocialCreditCode, legalPerson);

        ValidationResult validation = validateBasicParams(enterpriseName, unifiedSocialCreditCode, legalPerson);
        if (!validation.isValid()) {
            return VerificationResult.fail(validation.getMessage(),
                    "参数校验失败", null);
        }

        if (!checkRateLimit(unifiedSocialCreditCode)) {
            return VerificationResult.fail("请求过于频繁，请稍后再试",
                    "限流保护触发", null);
        }

        try {
            VerificationResult cachedResult = getCachedResult(unifiedSocialCreditCode);
            if (cachedResult != null) {
                log.info("命中缓存，企业: {}", enterpriseName);
                cachedResult.setVerifySource(cachedResult.getVerifySource() + "(缓存)");
                return cachedResult;
            }
        } catch (Exception e) {
            log.warn("读取缓存异常，继续执行实时查询", e);
        }

        VerificationResult result;
        if (mockMode) {
            result = mockVerify(enterpriseName, unifiedSocialCreditCode, legalPerson);
        } else {
            result = realVerify(enterpriseName, unifiedSocialCreditCode, legalPerson, businessLicenseUrl);
        }

        if (result.isPassed()) {
            try {
                cacheResult(unifiedSocialCreditCode, result);
            } catch (Exception e) {
                log.warn("写入缓存异常", e);
            }
        }

        return result;
    }

    private ValidationResult validateBasicParams(String enterpriseName, String unifiedSocialCreditCode, String legalPerson) {
        if (!validateCreditCode(unifiedSocialCreditCode)) {
            return ValidationResult.fail("统一社会信用代码格式不正确，应为18位有效字符");
        }

        if (StrUtil.isBlank(enterpriseName) || enterpriseName.length() < 4) {
            return ValidationResult.fail("企业名称不合法，至少4个字符");
        }

        if (!enterpriseName.matches("^[\\u4e00-\\u9fa5A-Za-z0-9()（）\\-·]+$")) {
            return ValidationResult.fail("企业名称包含非法字符");
        }

        if (StrUtil.isBlank(legalPerson) || legalPerson.length() < 2) {
            return ValidationResult.fail("法人姓名不合法，至少2个字符");
        }

        if (!legalPerson.matches("^[\\u4e00-\\u9fa5·]{2,20}$")) {
            return ValidationResult.fail("法人姓名格式不正确");
        }

        return ValidationResult.success();
    }

    private boolean checkRateLimit(String key) {
        try {
            String rateKey = RATE_LIMIT_PREFIX + key;
            Long count = stringRedisTemplate.opsForValue().increment(rateKey, 1);
            if (count != null && count == 1) {
                stringRedisTemplate.expire(rateKey, 1, TimeUnit.MINUTES);
            }
            return count == null || count <= MAX_REQUESTS_PER_MINUTE;
        } catch (Exception e) {
            log.warn("Redis限流检查异常，默认放行", e);
            return true;
        }
    }

    private VerificationResult getCachedResult(String creditCode) {
        String cacheKey = CACHE_PREFIX + creditCode;
        String cached = stringRedisTemplate.opsForValue().get(cacheKey);
        if (StrUtil.isNotBlank(cached)) {
            try {
                return JSONUtil.toBean(cached, VerificationResult.class);
            } catch (Exception e) {
                log.warn("解析缓存数据异常", e);
            }
        }
        return null;
    }

    private void cacheResult(String creditCode, VerificationResult result) {
        String cacheKey = CACHE_PREFIX + creditCode;
        stringRedisTemplate.opsForValue().set(
                cacheKey,
                JSONUtil.toJsonStr(result),
                cacheHours,
                TimeUnit.HOURS
        );
    }

    private VerificationResult mockVerify(String enterpriseName, String unifiedSocialCreditCode, String legalPerson) {
        log.info("[模拟模式] 执行企业资质自动审核，企业: {}", enterpriseName);

        if (enterpriseName.contains("测试") || enterpriseName.contains("异常")) {
            return VerificationResult.fail("企业名称包含敏感关键词",
                    "模拟模式-名称校验失败", null);
        }

        Map<String, Object> enterpriseInfo = new HashMap<>();
        enterpriseInfo.put("enterpriseName", enterpriseName);
        enterpriseInfo.put("unifiedSocialCreditCode", unifiedSocialCreditCode);
        enterpriseInfo.put("legalPerson", legalPerson);
        enterpriseInfo.put("registeredCapital", "500万人民币");
        enterpriseInfo.put("registrationDate", "2020-01-01");
        enterpriseInfo.put("status", "存续");
        enterpriseInfo.put("industry", "信息技术服务业");
        enterpriseInfo.put("organizationCode", unifiedSocialCreditCode.substring(8, 17));
        enterpriseInfo.put("taxNumber", unifiedSocialCreditCode);
        enterpriseInfo.put("registeredAuthority", "XX市市场监督管理局");
        enterpriseInfo.put("approvedDate", "2020-01-01");
        enterpriseInfo.put("businessTerm", "2020-01-01 至 长期");
        enterpriseInfo.put("registeredAddress", "北京市朝阳区XX街道XX号");
        enterpriseInfo.put("businessScope", "技术开发、技术咨询、技术服务、技术转让；计算机系统服务等");

        return VerificationResult.pass("模拟模式-自动审核通过",
                "工商信息API(模拟)对接成功", enterpriseInfo);
    }

    private VerificationResult realVerify(String enterpriseName, String unifiedSocialCreditCode,
                                          String legalPerson, String businessLicenseUrl) {
        log.info("调用工商信息API进行企业认证，企业: {}, 信用代码: {}", enterpriseName, unifiedSocialCreditCode);

        if (StrUtil.isBlank(appCode)) {
            log.warn("未配置AppCode，自动降级为模拟模式");
            VerificationResult fallbackResult = mockVerify(enterpriseName, unifiedSocialCreditCode, legalPerson);
            fallbackResult.setVerifySource(fallbackResult.getVerifySource() + "(未配置AppCode降级)");
            return fallbackResult;
        }

        Exception lastException = null;
        for (int retry = 0; retry <= MAX_RETRY_COUNT; retry++) {
            try {
                if (retry > 0) {
                    log.info("第{}次重试查询企业工商信息", retry);
                    Thread.sleep(500L * retry);
                }

                Map<String, Object> enterpriseInfo = fetchFromBusinessApi(unifiedSocialCreditCode, enterpriseName);

                if (enterpriseInfo == null || enterpriseInfo.isEmpty()) {
                    return VerificationResult.fail("未查询到企业工商信息，请确认信用代码是否正确",
                            "工商API查询无结果", null);
                }

                String apiEnterpriseName = StrUtil.trim((String) enterpriseInfo.get("enterpriseName"));
                String apiLegalPerson = StrUtil.trim((String) enterpriseInfo.get("legalPerson"));
                String status = StrUtil.trim((String) enterpriseInfo.get("status"));

                if (StrUtil.isBlank(status)) {
                    return VerificationResult.fail("工商信息返回数据格式异常：缺少经营状态",
                            "工商API数据解析异常", enterpriseInfo);
                }

                boolean isOperating = "存续".equals(status) || "在营".equals(status)
                        || "开业".equals(status) || "正常".equals(status) || "在业".equals(status);
                if (!isOperating) {
                    return VerificationResult.fail("企业经营状态异常：当前状态为【" + status + "】",
                            "经营状态验证失败", enterpriseInfo);
                }

                if (StrUtil.isBlank(apiEnterpriseName)) {
                    return VerificationResult.fail("工商信息返回数据格式异常：缺少企业名称",
                            "工商API数据解析异常", enterpriseInfo);
                }

                double nameSimilarity = calculateNameSimilarity(enterpriseName, apiEnterpriseName);
                if (nameSimilarity < 0.9) {
                    return VerificationResult.fail(
                            String.format("企业名称与工商登记信息不一致（相似度：%.0f%%），请核对后重新提交", nameSimilarity * 100),
                            "企业名称比对失败（提交: " + enterpriseName + ", 工商登记: " + apiEnterpriseName + "）",
                            enterpriseInfo);
                }

                if (!StrUtil.equals(legalPerson, apiLegalPerson)) {
                    return VerificationResult.fail(
                            "法人信息与工商登记不一致，登记法人为：" + apiLegalPerson,
                            "法人信息比对失败（提交: " + legalPerson + ", 工商登记: " + apiLegalPerson + "）",
                            enterpriseInfo);
                }

                log.info("企业资质审核通过，企业: {}, 经营状态: {}, 相似度: {:.0f}%",
                        enterpriseName, status, nameSimilarity * 100);
                return VerificationResult.pass("自动审核通过",
                        "工商信息验证成功（天眼查数据源）", enterpriseInfo);

            } catch (ApiAuthException e) {
                log.error("工商API鉴权失败，不再重试: {}", e.getMessage());
                lastException = e;
                break;
            } catch (ApiRateLimitException e) {
                log.error("工商API限流触发，等待后重试: {}", e.getMessage());
                lastException = e;
                try {
                    Thread.sleep(2000);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                }
            } catch (ApiNetworkException e) {
                log.warn("工商API网络异常，第{}次: {}", retry + 1, e.getMessage());
                lastException = e;
            } catch (ApiDataException e) {
                log.error("工商API返回数据异常: {}", e.getMessage());
                lastException = e;
                break;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                lastException = e;
                break;
            } catch (Exception e) {
                log.error("企业资质审核未知异常", e);
                lastException = e;
            }
        }

        String errorMsg = "审核系统异常，请稍后重试";
        String verifyDetail = "审核异常";
        if (lastException != null) {
            if (lastException instanceof ApiAuthException) {
                errorMsg = "工商信息服务鉴权失败，请联系管理员";
                verifyDetail = "API鉴权异常：" + lastException.getMessage();
            } else if (lastException instanceof ApiRateLimitException) {
                errorMsg = "工商信息服务访问量过大，请稍后再试";
                verifyDetail = "API限流异常：" + lastException.getMessage();
            } else if (lastException instanceof ApiNetworkException) {
                errorMsg = "工商信息服务连接超时，请稍后重试";
                verifyDetail = "API网络异常：" + lastException.getMessage();
            } else {
                verifyDetail = "审核异常：" + lastException.getMessage();
            }
        }

        return VerificationResult.fail(errorMsg, verifyDetail, null);
    }

    private Map<String, Object> fetchFromBusinessApi(String creditCode, String enterpriseName) throws Exception {
        log.info("调用阿里云市场工商信息API，信用代码: {}, 企业名称: {}", creditCode, enterpriseName);

        String url = buildApiUrl(creditCode, enterpriseName);
        log.debug("请求URL: {}", url);

        HttpRequest request = HttpUtil.createGet(url)
                .header("Authorization", "APPCODE " + appCode)
                .header("Content-Type", "application/json; charset=UTF-8")
                .header("Accept", "application/json")
                .setConnectionTimeout(connectTimeout)
                .setReadTimeout(readTimeout);

        HttpResponse response;
        try {
            response = request.execute();
        } catch (Exception e) {
            throw new ApiNetworkException("连接工商信息API失败: " + e.getMessage(), e);
        }

        int statusCode = response.getStatus();
        String responseBody = response.body();
        log.debug("API响应状态: {}, 响应内容: {}", statusCode, responseBody);

        switch (statusCode) {
            case 200:
                break;
            case 400:
                throw new ApiDataException("请求参数错误: " + responseBody);
            case 401:
            case 403:
                throw new ApiAuthException("AppCode鉴权失败，请检查配置是否正确，HTTP状态码: " + statusCode);
            case 429:
                throw new ApiRateLimitException("API调用频率超限，请稍后再试");
            case 500:
            case 502:
            case 503:
                throw new ApiNetworkException("工商信息API服务端异常，状态码: " + statusCode);
            default:
                throw new ApiNetworkException("工商信息API返回非预期状态码: " + statusCode);
        }

        if (StrUtil.isBlank(responseBody)) {
            throw new ApiDataException("工商API返回空响应");
        }

        JSONObject json;
        try {
            json = JSONUtil.parseObj(responseBody);
        } catch (Exception e) {
            throw new ApiDataException("工商API返回JSON解析失败: " + responseBody);
        }

        String code = json.getStr("code", json.getStr("status", "200"));
        String msg = json.getStr("msg", json.getStr("message", ""));

        if (StrUtil.isNotBlank(code) && !"200".equals(code) && !"0".equals(code) && !"SUCCESS".equalsIgnoreCase(code)) {
            log.warn("工商API业务返回码: {}, 消息: {}", code, msg);
            if ("429".equals(code) || "RATE_LIMIT".equalsIgnoreCase(code)) {
                throw new ApiRateLimitException("API业务限流: " + msg);
            }
            if (!"404".equals(code) && !"NOT_FOUND".equalsIgnoreCase(code)) {
                throw new ApiDataException("工商API业务异常: " + msg);
            }
            return null;
        }

        Object dataObj = json.get("data");
        if (dataObj == null) {
            return null;
        }

        if (dataObj instanceof JSONObject dataJson) {
            Map<String, Object> result = new HashMap<>();
            result.put("enterpriseName", extractField(dataJson, "name", "companyName", "enterpriseName"));
            result.put("unifiedSocialCreditCode", extractField(dataJson, "creditCode", "unifiedSocialCreditCode", "uscc"));
            result.put("legalPerson", extractField(dataJson, "legalPerson", "frName", "operName", "legalRepresentative"));
            result.put("registeredCapital", extractField(dataJson, "registCapi", "registeredCapital"));
            result.put("registrationDate", extractField(dataJson, "startDate", "esDate", "registrationDate", "establishDate"));
            result.put("status", extractField(dataJson, "status", "regStatus", "operStatus", "enterpriseStatus"));
            result.put("industry", extractField(dataJson, "industry", "industryName", "industryPhy"));
            result.put("organizationCode", extractField(dataJson, "orgCode", "organizationCode"));
            result.put("taxNumber", extractField(dataJson, "taxNumber", "taxNo"));
            result.put("registeredAuthority", extractField(dataJson, "belongOrg", "regOrg", "registeredAuthority"));
            result.put("approvedDate", extractField(dataJson, "checkDate", "approvedDate"));
            result.put("businessTerm", extractField(dataJson, "businessTerm", "operPeriod"));
            result.put("registeredAddress", extractField(dataJson, "address", "regAddr", "registeredAddress"));
            result.put("businessScope", extractField(dataJson, "businessScope", "scope", "operScope"));
            result.put("region", extractField(dataJson, "area", "region", "district"));

            result.entrySet().removeIf(entry -> StrUtil.isBlank(StrUtil.toStringOrNull(entry.getValue())));

            return result.isEmpty() ? null : result;
        }

        return null;
    }

    private String buildApiUrl(String creditCode, String enterpriseName) {
        if (apiPath.contains("[") || apiPath.contains("]")) {
            throw new ApiAuthException("未正确配置工商信息API的完整请求路径，请在配置文件中设置verification.api.path");
        }

        StringBuilder url = new StringBuilder(apiHost);
        if (!apiPath.startsWith("/")) {
            url.append("/");
        }
        url.append(apiPath);

        url.append(apiPath.contains("?") ? "&" : "?")
                .append("keyword=").append(HttpUtil.encode(creditCode, "UTF-8"));

        if (StrUtil.isNotBlank(enterpriseName)) {
            url.append("&name=").append(HttpUtil.encode(enterpriseName, "UTF-8"));
        }

        return url.toString();
    }

    private String extractField(JSONObject json, String... keys) {
        for (String key : keys) {
            Object value = json.get(key);
            if (value != null && StrUtil.isNotBlank(value.toString())) {
                return StrUtil.trim(value.toString());
            }
        }
        return null;
    }

    private double calculateNameSimilarity(String name1, String name2) {
        if (StrUtil.equals(name1, name2)) {
            return 1.0;
        }
        if (name1 == null || name2 == null) {
            return 0.0;
        }

        String s1 = normalizeName(name1);
        String s2 = normalizeName(name2);

        if (StrUtil.equals(s1, s2)) {
            return 1.0;
        }

        int matches = 0;
        char[] chars1 = s1.toCharArray();
        for (char c : chars1) {
            if (s2.indexOf(c) >= 0) {
                matches++;
            }
        }

        return (double) matches / Math.max(s1.length(), s2.length());
    }

    private String normalizeName(String name) {
        return StrUtil.removeAll(name,
                "有限责任公司", "股份有限公司", "有限公司", "集团", "责任公司",
                "分公司", "子公司", "（", "）", "(", ")", "-", " ", "·")
                .toUpperCase();
    }

    public boolean validateCreditCode(String creditCode) {
        if (creditCode == null || creditCode.isEmpty()) {
            return false;
        }
        if (!ReUtil.isMatch(CREDIT_CODE_PATTERN, creditCode)) {
            return false;
        }
        return validateCreditCodeChecksum(creditCode);
    }

    private boolean validateCreditCodeChecksum(String creditCode) {
        try {
            String code = creditCode.toUpperCase();
            int[] weights = {1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28};
            char[] chars = code.substring(0, 17).toCharArray();
            int sum = 0;

            for (int i = 0; i < chars.length; i++) {
                char c = chars[i];
                int value;
                if (Character.isDigit(c)) {
                    value = c - '0';
                } else {
                    value = "0123456789ABCDEFGHJKLMNPQRTUWXY".indexOf(c);
                    if (value < 0) return false;
                }
                sum += value * weights[i];
            }

            int mod31 = 31 - (sum % 31);
            char checkChar = "0123456789ABCDEFGHJKLMNPQRTUWXY".charAt(mod31 % 31);

            return checkChar == code.charAt(17);
        } catch (Exception e) {
            return true;
        }
    }

    public boolean validateIdCard(String idCard) {
        if (idCard == null || idCard.isEmpty()) {
            return false;
        }
        try {
            return IdcardUtil.isValidCard(idCard);
        } catch (Exception e) {
            return false;
        }
    }

    public void clearCache(String creditCode) {
        String cacheKey = CACHE_PREFIX + creditCode;
        stringRedisTemplate.delete(cacheKey);
        log.info("已清除企业审核缓存，信用代码: {}", creditCode);
    }

    static class ValidationResult {
        private final boolean valid;
        private final String message;

        private ValidationResult(boolean valid, String message) {
            this.valid = valid;
            this.message = message;
        }

        static ValidationResult success() {
            return new ValidationResult(true, null);
        }

        static ValidationResult fail(String message) {
            return new ValidationResult(false, message);
        }

        boolean isValid() {
            return valid;
        }

        String getMessage() {
            return message;
        }
    }

    static class ApiAuthException extends RuntimeException {
        ApiAuthException(String message) { super(message); }
    }

    static class ApiRateLimitException extends RuntimeException {
        ApiRateLimitException(String message) { super(message); }
    }

    static class ApiNetworkException extends RuntimeException {
        ApiNetworkException(String message, Throwable cause) { super(message, cause); }
    }

    static class ApiDataException extends RuntimeException {
        ApiDataException(String message) { super(message); }
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class VerificationResult {
        private boolean passed;
        private String message;
        private LocalDateTime verifyTime;
        private String verifySource;
        private Map<String, Object> enterpriseInfo;

        public static VerificationResult pass(String message, String verifySource, Map<String, Object> enterpriseInfo) {
            return new VerificationResult(true, message, LocalDateTime.now(), verifySource, enterpriseInfo);
        }

        public static VerificationResult fail(String message, String verifySource, Map<String, Object> enterpriseInfo) {
            return new VerificationResult(false, message, LocalDateTime.now(), verifySource, enterpriseInfo);
        }
    }
}
