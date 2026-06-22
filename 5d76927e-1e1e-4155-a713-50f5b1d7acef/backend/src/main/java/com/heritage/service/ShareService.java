package com.heritage.service;

import com.heritage.entity.Heritage;
import com.heritage.entity.Inheritor;
import com.heritage.repository.HeritageRepository;
import com.heritage.repository.InheritorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class ShareService {

    @Value("${heritage.share.base-url:https://heritage.example.com}")
    private String baseUrl;

    @Value("${heritage.share.wechat-app-id:}")
    private String wechatAppId;

    @Autowired
    private HeritageRepository heritageRepository;

    @Autowired
    private InheritorRepository inheritorRepository;

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
        shareInfo.put("wechatConfig", wechatConfig);

        Map<String, String> weiboParams = new HashMap<>();
        weiboParams.put("title", heritage.getName());
        weiboParams.put("url", baseUrl + "/heritages/" + heritageId);
        weiboParams.put("pic", heritage.getCoverImage() != null ? heritage.getCoverImage() : "");
        weiboParams.put("searchPic", "true");
        shareInfo.put("weiboShareUrl", buildWeiboShareUrl(weiboParams));

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
        shareInfo.put("wechatConfig", wechatConfig);

        Map<String, String> weiboParams = new HashMap<>();
        weiboParams.put("title", inheritor.getName() + " - 非遗传承人");
        weiboParams.put("url", baseUrl + "/inheritors/" + inheritorId);
        weiboParams.put("pic", inheritor.getAvatar() != null ? inheritor.getAvatar() : "");
        shareInfo.put("weiboShareUrl", buildWeiboShareUrl(weiboParams));

        return shareInfo;
    }

    private Map<String, Object> buildWechatShareConfig(String title, String desc) {
        Map<String, Object> config = new HashMap<>();
        config.put("appId", wechatAppId);
        config.put("title", title + " - 非遗数字保护平台");
        config.put("desc", desc != null && desc.length() > 50 ? desc.substring(0, 50) + "..." : desc);
        config.put("link", baseUrl);
        config.put("type", "link");
        config.put("dataUrl", "");
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
        return sb.toString();
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
