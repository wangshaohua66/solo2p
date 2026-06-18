package com.wedding.suite.service.impl;

import com.aliyun.dysmsapi20170525.Client;
import com.aliyun.dysmsapi20170525.models.SendSmsRequest;
import com.aliyun.teaopenapi.models.Config;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tencentcloudapi.common.Credential;
import com.tencentcloudapi.common.profile.ClientProfile;
import com.tencentcloudapi.common.profile.HttpProfile;
import com.tencentcloudapi.sms.v20210111.SmsClient;
import com.tencentcloudapi.sms.v20210111.models.SendSmsResponse;
import com.wedding.suite.config.SmsProperties;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.service.SmsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class SmsServiceImpl implements SmsService {

    private static final Logger log = LoggerFactory.getLogger(SmsServiceImpl.class);

    private final SmsProperties props;
    private final ObjectMapper objectMapper;

    public SmsServiceImpl(SmsProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean isEnabled() {
        return props.getProvider() != null && !"none".equalsIgnoreCase(props.getProvider());
    }

    @Override
    public void send(String phone, String templateCode, Map<String, String> params) {
        if (!isEnabled()) {
            log.info("[SMS disabled] phone={}, params={}", phone, params);
            return;
        }
        try {
            switch (props.getProvider().toLowerCase()) {
                case "aliyun" -> sendAliyun(phone, templateCode, params);
                case "tencent" -> sendTencent(phone, templateCode, params);
                default -> log.warn("未知短信服务商: {}", props.getProvider());
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("短信发送失败 phone={}", phone, e);
            throw new BusinessException(ErrorCode.SMS_SEND_FAILED, "短信发送失败: " + e.getMessage());
        }
    }

    private void sendAliyun(String phone, String templateCode, Map<String, String> params) throws Exception {
        SmsProperties.Aliyun a = props.getAliyun();
        Config config = new Config()
                .setAccessKeyId(a.getAccessKeyId())
                .setAccessKeySecret(a.getAccessKeySecret());
        config.endpoint = "dysmsapi.aliyuncs.com";
        Client client = new Client(config);
        SendSmsRequest req = new SendSmsRequest()
                .setPhoneNumbers(phone)
                .setSignName(a.getSignName())
                .setTemplateCode(templateCode != null ? templateCode : a.getTemplateCode())
                .setTemplateParam(objectMapper.writeValueAsString(params));
        client.sendSms(req);
        log.info("阿里云短信已发送 phone={}", phone);
    }

    private void sendTencent(String phone, String templateCode, Map<String, String> params) throws Exception {
        SmsProperties.Tencent t = props.getTencent();
        Credential cred = new Credential(t.getSecretId(), t.getSecretKey());
        HttpProfile http = new HttpProfile();
        http.setEndpoint("sms.tencentcloudapi.com");
        ClientProfile profile = new ClientProfile();
        profile.setHttpProfile(http);
        SmsClient client = new SmsClient(cred, t.getRegion(), profile);
        com.tencentcloudapi.sms.v20210111.models.SendSmsRequest req =
                new com.tencentcloudapi.sms.v20210111.models.SendSmsRequest();
        req.setSmsSdkAppId(t.getSdkAppId());
        req.setSignName(t.getSignName());
        req.setTemplateId(String.valueOf(t.getTemplateId()));
        req.setPhoneNumberSet(new String[]{"+86" + phone});
        req.setTemplateParamSet(params.values().toArray(new String[0]));
        SendSmsResponse resp = client.SendSms(req);
        log.info("腾讯云短信已发送 phone={}, status={}", phone,
                resp.getSendStatusSet() != null && resp.getSendStatusSet().length > 0
                        ? resp.getSendStatusSet()[0].getCode() : "unknown");
    }
}
