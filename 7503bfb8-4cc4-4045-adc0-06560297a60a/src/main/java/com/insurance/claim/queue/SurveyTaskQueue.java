package com.insurance.claim.queue;

import com.insurance.claim.entity.Claim;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Component
public class SurveyTaskQueue {

    private final ConcurrentLinkedQueue<Claim> pendingQueue = new ConcurrentLinkedQueue<>();
    private final ConcurrentLinkedQueue<Claim> processingQueue = new ConcurrentLinkedQueue<>();
    private final ExecutorService dispatcherExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean running = new AtomicBoolean(true);
    private SurveyTaskDispatcher dispatcher;

    public void setDispatcher(SurveyTaskDispatcher dispatcher) {
        this.dispatcher = dispatcher;
        startDispatcher();
    }

    private void startDispatcher() {
        dispatcherExecutor.submit(() -> {
            while (running.get()) {
                try {
                    Claim claim = pendingQueue.poll();
                    if (claim != null) {
                        processingQueue.offer(claim);
                        try {
                            log.info("队列处理查勘任务: 案件{}", claim.getClaimNo());
                            if (dispatcher != null) {
                                dispatcher.dispatch(claim);
                            }
                        } catch (Exception e) {
                            log.error("查勘任务调度失败: {}", claim.getClaimNo(), e);
                            pendingQueue.offer(claim);
                        } finally {
                            processingQueue.remove(claim);
                        }
                    } else {
                        Thread.sleep(1000);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    log.error("查勘任务队列异常", e);
                }
            }
        });
        log.info("查勘任务队列启动成功");
    }

    @Async
    public void enqueue(Claim claim) {
        if (claim == null) {
            return;
        }
        log.info("报案信息入查勘任务队列: 案件{}", claim.getClaimNo());
        boolean added = pendingQueue.offer(claim);
        if (!added) {
            log.warn("查勘任务队列已满，案件{}入队失败，尝试直接调度", claim.getClaimNo());
            if (dispatcher != null) {
                try {
                    dispatcher.dispatch(claim);
                } catch (Exception e) {
                    log.error("直接调度失败: {}", claim.getClaimNo(), e);
                }
            }
        }
    }

    public int getPendingCount() {
        return pendingQueue.size();
    }

    public int getProcessingCount() {
        return processingQueue.size();
    }

    public void shutdown() {
        running.set(false);
        dispatcherExecutor.shutdown();
    }

    public interface SurveyTaskDispatcher {
        void dispatch(Claim claim) throws Exception;
    }
}
