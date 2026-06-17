package com.heritage.artifact;

import cn.hutool.core.util.IdUtil;
import com.heritage.artifact.dto.ArtifactSearchDTO;
import com.heritage.artifact.entity.Artifact;
import com.heritage.artifact.enums.ArtifactLevel;
import com.heritage.artifact.enums.ArtifactStatus;
import com.heritage.artifact.enums.ArtifactType;
import com.heritage.artifact.repository.ArtifactRepository;
import com.heritage.artifact.service.ArtifactSearchService;
import com.heritage.artifact.service.ArtifactService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(classes = ArtifactServiceApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Rollback
class ArtifactSearchPerformanceTests {

    @Autowired private ArtifactService artifactService;
    @Autowired private ArtifactRepository artifactRepository;
    @Autowired private ArtifactSearchService searchService;

    private static final String[] DYNASTIES = {"商","西周","春秋","战国","秦","汉","唐","宋","元","明","清"};
    private static final String[] MATERIALS = {"青铜","陶瓷","玉器","绢本","纸本","漆木","金","银","象牙","玻璃"};
    private static final String[] NAMES = {"方鼎","圆鼎","鬲","簋","尊","壶","盘","匜","钟","剑","镜","瓶","碗","盘","罐","炉","杯"};
    private static final ArtifactType[] TYPES = ArtifactType.values();
    private static final ArtifactLevel[] LEVELS = ArtifactLevel.values();
    private static int INSERTED;

    @Test
    @Order(0)
    @Transactional
    void test0_prepareMillionLikeData() {
        if (artifactRepository.count() >= 1000) {
            System.out.println("[PREP] 已有基础数据: " + artifactRepository.count());
            return;
        }
        long start = System.currentTimeMillis();
        List<Artifact> batch = new ArrayList<>(500);
        int target = 5000;
        for (int i = 0; i < target; i++) {
            Artifact a = Artifact.builder()
                .artifactCode("WH" + System.nanoTime() + i)
                .name(rnd(NAMES) + "·" + rnd(DYNASTIES) + rnd(MATERIALS))
                .type(TYPES[i % TYPES.length])
                .level(LEVELS[i % LEVELS.length])
                .status(ArtifactStatus.NORMAL)
                .dynasty(rnd(DYNASTIES))
                .era(rnd(DYNASTIES) + (i % 50) + "年")
                .origin(rnd(new String[]{"河南安阳","陕西西安","山东济南","江苏南京","浙江杭州","湖北荆州","四川广汉","湖南长沙"}))
                .material(rnd(MATERIALS))
                .technique(rnd(new String[]{"范铸法","失蜡法","轮制","手制","拉坯","雕刻","鎏金","镶嵌","绘画"}))
                .description("这是一件典型的" + rnd(DYNASTIES) + rnd(MATERIALS) +
                    "器，器身饰有" + rnd(new String[]{"饕餮纹","云雷纹","蟠螭纹","回纹","夔龙纹","凤鸟纹","莲瓣纹"}) +
                    "，整体造型庄重典雅，具有极高的历史研究价值和艺术价值。编号#" + i)
                .historicalNote("来源：" + rnd(new String[]{"故宫旧藏","考古发掘","社会征集","私人捐赠","海外追索"}) +
                    "，曾在" + rnd(new String[]{"国家博物馆","上海博物馆","南京博物院","河南博物院"}) + "展出")
                .dimensions("高" + (20 + i % 80) + "cm，口径" + (10 + i % 50) + "cm")
                .weight(String.valueOf(1 + (i % 100) / 10.0) + "kg")
                .discoveryLocation(rnd(new String[]{"殷墟遗址","兵马俑坑","马王堆汉墓","三星堆遗址","良渚古城"}))
                .currentLocation("省博物馆第" + ((i % 12) + 1) + "展厅")
                .inscription(rnd(new String[]{"","唯王十又二年","子子孙孙永宝用","某某作宝尊彝","大明嘉靖年制","大清乾隆年制"}))
                .dataAccessLevel(i % 4 + 1)
                .build();
            batch.add(a);
            if (batch.size() >= 500) {
                artifactRepository.saveAll(batch);
                batch.clear();
            }
        }
        if (!batch.isEmpty()) artifactRepository.saveAll(batch);
        INSERTED = target;
        long cost = System.currentTimeMillis() - start;
        System.out.println("[PREP] 初始化数据 " + target + " 条，耗时 " + cost + "ms (" + (target*1000/Math.max(1,cost)) + " inserts/s)");
    }

    @Test
    @Order(1)
    void test1_singleKeywordSearch_MongoFallback() {
        ArtifactSearchDTO dto = new ArtifactSearchDTO();
        dto.setKeyword("饕餮纹 青铜"); dto.setPage(0); dto.setSize(20);
        dto.setSortBy("createTime"); dto.setSortDir("DESC");
        long t0 = System.nanoTime();
        Page<Artifact> p = artifactService.searchArtifacts(dto);
        long cost = (System.nanoTime() - t0) / 1_000_000L;
        System.out.println("[SEARCH-MULTI] keyword='饕餮纹 青铜' hits=" + p.getTotalElements() +
            " pageSize=" + p.getContent().size() + " 耗时=" + cost + "ms");
        assertTrue(cost < 1500, "首次检索 < 1500ms (实际 " + cost + "ms)");
    }

    @Test
    @Order(2)
    void test2_100ConcurrentSearches_performanceTarget() throws InterruptedException {
        int threads = 60, per = 2;
        ExecutorService exec = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads * per);
        AtomicLong total = new AtomicLong(), max = new AtomicLong(), min = new AtomicLong(Long.MAX_VALUE);
        AtomicLong okCount = new AtomicLong();
        String[] kws = {"青铜","饕餮纹","马王堆","良渚","大明嘉靖年制","河南","故宫","瓷器","玉器","绘画"};
        long global = System.currentTimeMillis();
        for (int t = 0; t < threads; t++) {
            for (int i = 0; i < per; i++) {
                final String kw = kws[(t + i) % kws.length] + (i % 3 == 0 ? "" : " 鼎");
                exec.submit(() -> {
                    try {
                        ArtifactSearchDTO dto = new ArtifactSearchDTO();
                        dto.setKeyword(kw); dto.setPage(0); dto.setSize(20);
                        dto.setSortBy("createTime"); dto.setSortDir("DESC");
                        long t0 = System.nanoTime();
                        Page<Artifact> p = artifactService.searchArtifacts(dto);
                        long c = (System.nanoTime() - t0) / 1_000_000L;
                        total.addAndGet(c);
                        max.updateAndGet(v -> Math.max(v, c));
                        min.updateAndGet(v -> Math.min(v, c));
                        if (c < 1500 && p.hasContent()) okCount.incrementAndGet();
                    } finally {
                        latch.countDown();
                    }
                });
            }
        }
        assertTrue(latch.await(120, TimeUnit.SECONDS));
        exec.shutdown();
        long globalCost = System.currentTimeMillis() - global;
        long cnt = threads * per;
        double avg = total.get() * 1.0 / cnt;
        double qps = cnt * 1000.0 / Math.max(1, globalCost);
        System.out.println("[PERF] 并发=" + cnt + " 总耗时=" + globalCost + "ms");
        System.out.println("[PERF] 平均响应=" + String.format("%.2f",avg) + "ms 最小=" + min.get() + "ms 最大=" + max.get() + "ms");
        System.out.println("[PERF] 实际QPS=" + String.format("%.2f",qps) + " 达标率=" + (okCount.get()*100/cnt) + "%");
        assertTrue(avg < 1500, "平均响应 < 1500ms (实际 " + String.format("%.2f",avg) + "ms)");
        assertTrue(qps >= 50, "QPS ≥ 50 (实际 " + String.format("%.2f",qps) + ")");
        assertTrue(okCount.get() * 100 / cnt >= 99, "达标率 ≥ 99% (实际 " + (okCount.get()*100/cnt) + "%)");
    }

    @Test
    @Order(3)
    void test3_exactFieldFilter() {
        ArtifactSearchDTO dto = new ArtifactSearchDTO();
        dto.setType(ArtifactType.BRONZE);
        dto.setLevel(ArtifactLevel.FIRST);
        dto.setDynasty("商");
        dto.setPage(0); dto.setSize(100);
        dto.setSortBy("createTime"); dto.setSortDir("DESC");
        long t0 = System.nanoTime();
        Page<Artifact> p = artifactService.searchArtifacts(dto);
        long c = (System.nanoTime()-t0)/1_000_000L;
        System.out.println("[FILTER] 商代+一级+青铜器 hits=" + p.getTotalElements() + " 耗时=" + c + "ms");
        assertTrue(c < 500, "过滤检索 < 500ms");
    }

    @Test
    @Order(4)
    void test4_crudRoundTrip() {
        Artifact a = Artifact.builder()
            .name("性能测试专用·青铜小鼎")
            .type(ArtifactType.BRONZE)
            .level(ArtifactLevel.SECOND)
            .dynasty("周")
            .description("CRUD 往返测试小器物")
            .build();
        long t0 = System.currentTimeMillis();
        Artifact saved = artifactService.createArtifact(a);
        long ins = System.currentTimeMillis() - t0;
        assertNotNull(saved.getId());
        Artifact f = artifactService.getArtifactById(saved.getId());
        assertEquals("周", f.getDynasty());
        f.setDescription("CRUD 往返更新: " + IdUtil.fastSimpleUUID());
        long t1 = System.currentTimeMillis();
        artifactService.updateArtifact(saved.getId(), f);
        long upd = System.currentTimeMillis() - t1;
        long t2 = System.currentTimeMillis();
        artifactService.deleteArtifact(saved.getId());
        long del = System.currentTimeMillis() - t2;
        System.out.println("[CRUD] insert=" + ins + "ms update=" + upd + "ms delete=" + del + "ms");
    }

    private <T> T rnd(T[] arr) { return arr[(int)(Math.random()*arr.length)]; }
}
