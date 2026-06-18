package com.wedding.suite.service;

import java.util.Map;

public interface SmsService {
    void send(String phone, String templateCode, Map<String, String> params);

    default void send(String phone, Map<String, String> params) {
        send(phone, null, params);
    }

    boolean isEnabled();
}
