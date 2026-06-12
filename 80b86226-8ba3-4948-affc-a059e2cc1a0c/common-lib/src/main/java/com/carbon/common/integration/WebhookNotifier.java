package com.carbon.common.integration;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebhookNotifier {

    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");
    private final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(5, TimeUnit.SECONDS)
            .build();

    @Data
    public static class WebhookTarget {
        private String platform;
        private String url;
        private String secret;
    }

    public void sendDingtalkMarkdown(String url, String secret,
                                     String title, String markdownContent,
                                     List<String> atMobiles, boolean atAll) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("msgtype", "markdown");
        Map<String, String> md = new HashMap<>();
        md.put("title", title);
        md.put("text", markdownContent);
        payload.put("markdown", md);
        Map<String, Object> at = new HashMap<>();
        at.put("atMobiles", atMobiles);
        at.put("isAtAll", atAll);
        payload.put("at", at);
        postRaw(url, payload);
    }

    public void sendDingtalkText(String url, String secret,
                                 String content,
                                 List<String> atMobiles, boolean atAll) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("msgtype", "text");
        Map<String, String> t = new HashMap<>();
        t.put("content", content);
        payload.put("text", t);
        Map<String, Object> at = new HashMap<>();
        at.put("atMobiles", atMobiles);
        at.put("isAtAll", atAll);
        payload.put("at", at);
        postRaw(url, payload);
    }

    public void sendFeishuInteractive(String url,
                                      String title, String content,
                                      String color, List<Map<String, String>> actions) {
        Map<String, Object> card = new HashMap<>();
        card.put("config", Map.of("wide_screen_mode", true));
        Map<String, Object> header = new HashMap<>();
        header.put("title", Map.of("tag", "plain_text", "content", title));
        header.put("template", color);
        card.put("header", header);
        Map<String, Object> element = new HashMap<>();
        element.put("tag", "markdown");
        element.put("content", content);
        card.put("elements", List.of(element));
        if (actions != null && !actions.isEmpty()) {
            Map<String, Object> actionEl = new HashMap<>();
            actionEl.put("tag", "actions");
            actionEl.put("actions", actions);
            card.put("elements", List.of(element, actionEl));
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("msg_type", "interactive");
        payload.put("card", card);
        postRaw(url, payload);
    }

    public void sendFeishuText(String url, String content) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("msg_type", "text");
        payload.put("content", Map.of("text", content));
        postRaw(url, payload);
    }

    private void postRaw(String url, Object body) {
        try {
            String json = cn.hutool.json.JSONUtil.toJsonStr(body);
            Request req = new Request.Builder()
                    .url(url)
                    .post(RequestBody.create(json, JSON))
                    .build();
            try (Response resp = client.newCall(req).execute()) {
                if (!resp.isSuccessful()) {
                    log.warn("Webhook call failed: url={} status={} body={}",
                            url, resp.code(), resp.body() != null ? resp.body().string() : "");
                } else {
                    log.debug("Webhook success: url={}", url);
                }
            }
        } catch (Exception e) {
            log.warn("Webhook exception: url={} message={}", url, e.getMessage());
        }
    }
}
