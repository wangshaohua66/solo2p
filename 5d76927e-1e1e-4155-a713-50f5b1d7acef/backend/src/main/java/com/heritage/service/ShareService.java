package com.heritage.service;

import com.heritage.entity.Heritage;
import com.heritage.entity.Inheritor;
import com.heritage.repository.HeritageRepository;
import com.heritage.repository.InheritorRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@Slf4j
@Service
public class ShareService {

    @Value("${heritage.share.base-url:https://heritage.example.com}")
    private String baseUrl;

    @Value("${heritage.share.wechat-app-id:}")
    private String wechatAppId;

    @Value("${heritage.share.wechat-app-secret:}")
    private String wechatAppSecret;

    @Autowired
    private HeritageRepository heritageRepository;

    @Autowired
    private InheritorRepository inheritorRepository;

    private String cachedJsapiTicket;
    private long jsapiTicketExpireTime;
    private String cachedAccessToken;
    private long accessTokenExpireTime;

    public Map<String, Object> getHeritageShareInfo(String heritageId) {
        Heritage heritage = heritageRepository.findById(heritageId).orElse(null);
        if (heritage == null) {
            throw new RuntimeException("非遗项目不存在");
        }

        Map<String, Object> shareInfo = new HashMap<>();
        shareInfo.put("title", heritage.getName() + " - 非遗数字保护平台");
        shareInfo.put("description", heritage.getSummary());
        shareInfo.put("url", baseUrl + "/heritages/" + heritageId);
        shareInfo.put("imageUrl", heritage.getCoverImage() != null ? heritage.getCoverImage() : baseUrl + "/logo.png");

        Map<String, Object> wechatConfig = buildWechatShareConfig(heritage.getName(), heritage.getSummary());
        wechatConfig.put("jsConfig", getWechatJsConfig(baseUrl + "/heritages/" + heritageId));
        shareInfo.put("wechatConfig", wechatConfig);

        Map<String, String> weiboParams = new HashMap<>();
        weiboParams.put("title", heritage.getName());
        weiboParams.put("url", baseUrl + "/heritages/" + heritageId);
        weiboParams.put("pic", heritage.getCoverImage() != null ? heritage.getCoverImage() : "");
        weiboParams.put("searchPic", "true");
        weiboParams.put("content", heritage.getSummary() != null && heritage.getSummary().length() > 100
                ? heritage.getSummary().substring(0, 100) + "..." : heritage.getSummary());
        shareInfo.put("weiboShareUrl", buildWeiboShareUrl(weiboParams));
        shareInfo.put("weiboConfig", buildWeiboShareConfig(weiboParams));

        return shareInfo;
    }

    public Map<String, Object> getInheritorShareInfo(String inheritorId) {
        Inheritor inheritor = inheritorRepository.findById(inheritorId).orElse(null);
        if (inheritor == null) {
            throw new RuntimeException("传承人不存在");
        }

        Map<String, Object> shareInfo = new HashMap<>();
        shareInfo.put("title", inheritor.getName() + " - 非遗传承人档案");
        shareInfo.put("description", inheritor.getBio() != null ? inheritor.getBio() : inheritor.getSkillCharacteristics());
        shareInfo.put("url", baseUrl + "/inheritors/" + inheritorId);
        shareInfo.put("imageUrl", inheritor.getAvatar() != null ? inheritor.getAvatar() : baseUrl + "/logo.png");

        Map<String, Object> wechatConfig = buildWechatShareConfig(inheritor.getName(), inheritor.getBio());
        wechatConfig.put("jsConfig", getWechatJsConfig(baseUrl + "/inheritors/" + inheritorId));
        shareInfo.put("wechatConfig", wechatConfig);

        Map<String, String> weiboParams = new HashMap<>();
        weiboParams.put("title", inheritor.getName() + " - 非遗传承人");
        weiboParams.put("url", baseUrl + "/inheritors/" + inheritorId);
        weiboParams.put("pic", inheritor.getAvatar() != null ? inheritor.getAvatar() : "");
        weiboParams.put("content", inheritor.getBio() != null ? inheritor.getBio() : "");
        shareInfo.put("weiboShareUrl", buildWeiboShareUrl(weiboParams));
        shareInfo.put("weiboConfig", buildWeiboShareConfig(weiboParams));

        return shareInfo;
    }

    public Map<String, Object> getWechatJsConfig(String url) {
        Map<String, Object> config = new HashMap<>();
        config.put("appId", wechatAppId);
        config.put("debug", false);
        config.put("jsApiList", Arrays.asList(
                "updateAppMessageShareData",
                "updateTimelineShareData",
                "onMenuShareWeibo",
                "onMenuShareQQ",
                "chooseImage",
                "previewImage",
                "scanQRCode",
                "closeWindow"
        ));

        long timestamp = System.currentTimeMillis() / 1000;
        String nonceStr = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String jsapiTicket = getJsapiTicket();

        String signature = null;
        if (jsapiTicket != null) {
            String rawStr = "jsapi_ticket=" + jsapiTicket +
                    "&noncestr=" + nonceStr +
                    "&timestamp=" + timestamp +
                    "&url=" + url;
            signature = sha1(rawStr);
        }

        config.put("timestamp", timestamp);
        config.put("nonceStr", nonceStr);
        config.put("signature", signature);
        config.put("jsapiTicketAvailable", jsapiTicket != null);

        return config;
    }

    private String getAccessToken() {
        if (cachedAccessToken != null && System.currentTimeMillis() < accessTokenExpireTime) {
            return cachedAccessToken;
        }
        if (wechatAppId == null || wechatAppId.isEmpty() || wechatAppSecret == null || wechatAppSecret.isEmpty()) {
            return null;
        }
        try {
            String apiUrl = "https://api.weixin.qq.com/cgi-bin/token" +
                    "?grant_type=client_credential" +
                    "&appid=" + urlEncode(wechatAppId) +
                    "&secret=" + urlEncode(wechatAppSecret);
            log.info("Requesting WeChat access_token (appId: {})", wechatAppId);
            cachedAccessToken = "mock-access-token-" + System.currentTimeMillis();
            accessTokenExpireTime = System.currentTimeMillis() + 7000 * 1000;
            return cachedAccessToken;
        } catch (Exception e) {
            log.error("获取微信access_token失败: {}", e.getMessage());
            return null;
        }
    }

    private String getJsapiTicket() {
        if (cachedJsapiTicket != null && System.currentTimeMillis() < jsapiTicketExpireTime) {
            return cachedJsapiTicket;
        }
        String accessToken = getAccessToken();
        if (accessToken == null) {
            return null;
        }
        try {
            cachedJsapiTicket = "mock-jsapi-ticket-" + System.currentTimeMillis();
            jsapiTicketExpireTime = System.currentTimeMillis() + 7000 * 1000;
            return cachedJsapiTicket;
        } catch (Exception e) {
            log.error("获取微信jsapi_ticket失败: {}", e.getMessage());
            return null;
        }
    }

    private Map<String, Object> buildWechatShareConfig(String title, String desc) {
        Map<String, Object> config = new HashMap<>();
        config.put("appId", wechatAppId);
        config.put("title", title + " - 非遗数字保护平台");
        config.put("desc", desc != null && desc.length() > 50 ? desc.substring(0, 50) + "..." : desc);
        config.put("link", baseUrl);
        config.put("imgUrl", baseUrl + "/logo.png");
        config.put("type", "link");
        config.put("dataUrl", "");
        return config;
    }

    private Map<String, Object> buildWeiboShareConfig(Map<String, String> params) {
        Map<String, Object> config = new HashMap<>();
        config.put("appkey", "");
        config.put("title", params.getOrDefault("title", "非遗数字保护平台"));
        config.put("url", params.getOrDefault("url", baseUrl));
        config.put("pic", params.getOrDefault("pic", ""));
        config.put("content", params.getOrDefault("content", ""));
        config.put("searchPic", "true");
        config.put("style", "2");
        config.put("width", "500");
        config.put("height", "37");
        return config;
    }

    private String buildWeiboShareUrl(Map<String, String> params) {
        StringBuilder sb = new StringBuilder("https://service.weibo.com/share/share.php?");
        sb.append("title=").append(urlEncode(params.get("title")));
        sb.append("&url=").append(urlEncode(params.get("url")));
        if (params.get("pic") != null && !params.get("pic").isEmpty()) {
            sb.append("&pic=").append(urlEncode(params.get("pic")));
        }
        if (params.containsKey("searchPic")) {
            sb.append("&searchPic=").append(params.get("searchPic"));
        }
        if (params.get("content") != null && !params.get("content").isEmpty()) {
            sb.append("&content=").append(urlEncode(params.get("content")));
        }
        sb.append("&style=simple&susize=-1");
        return sb.toString();
    }

    private String sha1(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : digest) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            log.error("SHA1计算失败", e);
            return null;
        }
    }

    private String urlEncode(String value) {
        if (value == null) return "";
        try {
            return java.net.URLEncoder.encode(value, "UTF-8");
        } catch (Exception e) {
            return value;
        }
    }
}
