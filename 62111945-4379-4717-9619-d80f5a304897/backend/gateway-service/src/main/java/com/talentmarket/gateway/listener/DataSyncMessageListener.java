package com.talentmarket.gateway.listener;

import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONUtil;
import com.talentmarket.gateway.service.CrossCenterDataService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSyncMessageListener implements MessageListener, ApplicationRunner {

    private final StringRedisTemplate stringRedisTemplate;
    private final RedisMessageListenerContainer redisMessageListenerContainer;
    private final CrossCenterDataService crossCenterDataService;

    private static final String DATA_SYNC_CHANNEL = "talent-market:data-sync";
    private static final String PROCESSED_MSG_KEY = "talent-market:sync:processed:";

    private final Set<String> processedMessageIds = Collections.newSetFromMap(new ConcurrentHashMap<>());
    private final AtomicBoolean started = new AtomicBoolean(false);

    @Override
    public void run(ApplicationArguments args) {
        if (started.compareAndSet(false, true)) {
            redisMessageListenerContainer.addMessageListener(this, new ChannelTopic(DATA_SYNC_CHANNEL));
            log.info("跨中心数据同步订阅监听器已启动，订阅频道: {}", DATA_SYNC_CHANNEL);

            startCleanupThread();
        }
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String body = new String(message.getBody(), StandardCharsets.UTF_8);
            log.debug("收到数据同步消息: {}", body);

            CrossCenterDataService.DataSyncMessage syncMsg;
            try {
                syncMsg = JSONUtil.toBean(body, CrossCenterDataService.DataSyncMessage.class);
            } catch (Exception e) {
                log.warn("解析同步消息格式异常", e);
                return;
            }

            if (syncMsg == null || StrUtil.isBlank(syncMsg.getSyncId())) {
                return;
            }

            if (isMessageProcessed(syncMsg.getSyncId())) {
                log.debug("消息已处理，跳过: {}", syncMsg.getSyncId());
                return;
            }

            markMessageProcessed(syncMsg.getSyncId());
            processSyncMessage(syncMsg);

        } catch (Exception e) {
            log.error("处理同步消息异常", e);
        }
    }

    private void processSyncMessage(CrossCenterDataService.DataSyncMessage msg) {
        log.info("处理数据同步: source={}, dataType={}, op={}, id={}",
                msg.getSourceCenterId(), msg.getDataType(), msg.getOperation(), msg.getDataId());

        switch (msg.getOperation()) {
            case CREATE, UPDATE, REFRESH -> {
                if (StrUtil.isNotBlank(msg.getDataJson())) {
                    crossCenterDataService.setCachedData(
                            msg.getDataType(),
                            msg.getDataId(),
                            msg.getDataJson(),
                            3600
                    );
                }
            }
            case DELETE -> {
                String cacheKey = "talent-market:data:" + msg.getDataType() + ":" + msg.getDataId();
                stringRedisTemplate.delete(cacheKey);
                log.info("已删除缓存数据: type={}, id={}", msg.getDataType(), msg.getDataId());
            }
        }

        switch (msg.getDataType()) {
            case "job" -> log.info("[职位数据同步] 职位ID={}, 操作={}", msg.getDataId(), msg.getOperation());
            case "enterprise", "enterprise-verify" -> log.info("[企业数据同步] 企业ID={}, 操作={}", msg.getDataId(), msg.getOperation());
            case "recruitment-fair" -> log.info("[招聘会同步] 招聘会ID={}, 操作={}", msg.getDataId(), msg.getOperation());
            case "resume" -> log.info("[简历数据同步] 简历ID={}, 操作={}", msg.getDataId(), msg.getOperation());
            case "application" -> log.info("[投递状态同步] 投递ID={}, 操作={}", msg.getDataId(), msg.getOperation());
            case "interview" -> log.info("[面试信息同步] 面试ID={}, 操作={}", msg.getDataId(), msg.getOperation());
            default -> log.debug("[其他数据同步] type={}, id={}", msg.getDataType(), msg.getDataId());
        }
    }

    private boolean isMessageProcessed(String syncId) {
        if (processedMessageIds.contains(syncId)) {
            return true;
        }
        Boolean exists = stringRedisTemplate.hasKey(PROCESSED_MSG_KEY + syncId);
        return Boolean.TRUE.equals(exists);
    }

    private void markMessageProcessed(String syncId) {
        processedMessageIds.add(syncId);
        stringRedisTemplate.opsForValue().set(
                PROCESSED_MSG_KEY + syncId,
                LocalDateTime.now().toString(),
                10,
                java.util.concurrent.TimeUnit.MINUTES
        );
    }

    private void startCleanupThread() {
        Thread cleanup = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    Thread.sleep(60_000L);
                    processedMessageIds.clear();
                    log.debug("清理本地消息处理记录，当前大小: {}", processedMessageIds.size());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    log.warn("清理消息处理记录异常", e);
                }
            }
        }, "data-sync-cleanup");
        cleanup.setDaemon(true);
        cleanup.start();
    }
}
