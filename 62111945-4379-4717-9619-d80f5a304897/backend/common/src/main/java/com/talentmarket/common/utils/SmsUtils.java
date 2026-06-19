package com.talentmarket.common.utils;

import com.aliyun.dysmsapi20170525.Client;
import com.aliyun.dysmsapi20170525.models.SendSmsRequest;
import com.aliyun.teaopenapi.models.Config;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
public class SmsUtils {

    @Value("${sms.aliyun.accessKeyId:}")
    private String accessKeyId;

    @Value("${sms.aliyun.accessKeySecret:}")
    private String accessKeySecret;

    @Value("${sms.aliyun.signName:}")
    private String signName;

    @Value("${sms.enabled:false}")
    private boolean enabled;

    private Client client;

    private Client createClient() throws Exception {
        Config config = new Config()
                .setAccessKeyId(accessKeyId)
                .setAccessKeySecret(accessKeySecret);
        config.endpoint = "dysmsapi.aliyuncs.com";
        return new Client(config);
    }

    public boolean sendSms(String phone, String templateCode, Map<String, String> params) {
        if (!enabled) {
            log.info("[模拟发送短信] 手机号: {}, 模板: {}, 参数: {}", phone, templateCode, params);
            return true;
        }

        try {
            if (client == null) {
                client = createClient();
            }

            SendSmsRequest sendSmsRequest = new SendSmsRequest()
                    .setPhoneNumbers(phone)
                    .setSignName(signName)
                    .setTemplateCode(templateCode)
                    .setTemplateParam(buildTemplateParam(params));

            com.aliyun.dysmsapi20170525.models.SendSmsResponse response = client.sendSms(sendSmsRequest);
            
            if ("OK".equals(response.getBody().getCode())) {
                log.info("短信发送成功，手机号: {}", phone);
                return true;
            } else {
                log.error("短信发送失败，手机号: {}, 错误码: {}, 错误信息: {}",
                        phone, response.getBody().getCode(), response.getBody().getMessage());
                return false;
            }
        } catch (Exception e) {
            log.error("短信发送异常，手机号: {}", phone, e);
            return false;
        }
    }

    private String buildTemplateParam(Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return "{}";
        }
        StringBuilder sb = new StringBuilder("{");
        int i = 0;
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(entry.getKey()).append("\":\"").append(entry.getValue()).append("\"");
            i++;
        }
        sb.append("}");
        return sb.toString();
    }

    public boolean sendInterviewInviteSms(String phone, String companyName, String position, String time) {
        Map<String, String> params = Map.of(
                "company", companyName,
                "position", position,
                "time", time
        );
        return sendSms(phone, "SMS_INTERVIEW_INVITE", params);
    }

    public boolean sendApplicationStatusSms(String phone, String position, String status) {
        Map<String, String> params = Map.of(
                "position", position,
                "status", status
        );
        return sendSms(phone, "SMS_APPLICATION_STATUS", params);
    }

    public boolean sendVerificationCodeSms(String phone, String code) {
        Map<String, String> params = Map.of("code", code);
        return sendSms(phone, "SMS_VERIFICATION_CODE", params);
    }
}
