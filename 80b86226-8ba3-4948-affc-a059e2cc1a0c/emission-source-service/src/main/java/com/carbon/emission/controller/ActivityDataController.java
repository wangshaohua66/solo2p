package com.carbon.emission.controller;

import cn.hutool.core.util.IdUtil;
import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.api.R;
import com.carbon.common.enums.ActivityDataType;
import com.carbon.emission.entity.ActivityData;
import com.carbon.emission.service.ActivityDataService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/activity-data")
@RequiredArgsConstructor
@Tag(name = "活动数据", description = "燃料/电力/热力/原料/运输等活动数据导入、校验、插值")
public class ActivityDataController {

    private final ActivityDataService service;

    @PostMapping
    @Operation(summary = "创建单条活动数据")
    public R<ActivityData> create(@Valid @RequestBody ActivityData data) {
        return R.ok(service.create(data));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新活动数据")
    public R<ActivityData> update(@PathVariable String id,
                                  @Valid @RequestBody ActivityData data) {
        return R.ok(service.update(id, data));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除活动数据")
    public R<Void> delete(@PathVariable String id) {
        service.delete(id);
        return R.ok();
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取活动数据详情")
    public R<ActivityData> getById(@PathVariable String id) {
        return R.ok(service.getById(id));
    }

    @GetMapping
    @Operation(summary = "分页查询活动数据")
    public R<PageResult<ActivityData>> list(
            @Parameter(description = "期间 YYYY-MM") @RequestParam(required = false) String period,
            @Parameter(description = "排放源ID") @RequestParam(required = false) String sourceId,
            @Parameter(description = "活动数据类型") @RequestParam(required = false) ActivityDataType type,
            @ParameterObject PageQuery pageQuery) {
        return R.ok(service.listByPeriod(period, sourceId, type, pageQuery));
    }

    @GetMapping("/batch/{batchId}")
    @Operation(summary = "按批次ID查询导入记录")
    public R<PageResult<ActivityData>> listByBatch(
            @PathVariable String batchId,
            @ParameterObject PageQuery pageQuery) {
        return R.ok(service.listByBatch(batchId, pageQuery));
    }

    @GetMapping("/summary")
    @Operation(summary = "月度数据汇总(总量/插值数/分类型)")
    public R<Map<String, Object>> summarize(
            @Parameter(description = "年度", required = true, example = "2024") @RequestParam Integer year,
            @Parameter(description = "月份", required = true, example = "6") @RequestParam Integer month) {
        return R.ok(service.summarize(year, month));
    }

    @PostMapping("/batch-import")
    @Operation(summary = "批量导入活动数据(1000条+建议Excel)")
    public R<Map<String, Object>> batchImport(@RequestBody List<ActivityData> list) {
        String batchId = "BATCH-" + IdUtil.fastSimpleUUID().toUpperCase().substring(0, 10);
        return R.ok(service.batchImport(list, batchId));
    }

    @PostMapping("/excel-import")
    @Operation(summary = "Excel文件导入活动数据")
    public R<Map<String, Object>> excelImport(
            @Parameter(description = "期间 YYYY-MM") @RequestParam String period,
            @Parameter(description = "Excel文件") @RequestParam("file") MultipartFile file) throws IOException {
        String batchId = "EXCEL-" + IdUtil.fastSimpleUUID().toUpperCase().substring(0, 10);
        List<ActivityData> list = parseExcel(file, period);
        return R.ok(service.batchImport(list, batchId));
    }

    @PostMapping("/interpolate")
    @Operation(summary = "运行缺失值插值(线性插值，基于历史窗口)",
            description = "按排放源遍历，缺失数据用前后windowSize个历史点线性插值")
    public R<Map<String, Object>> interpolate(
            @Parameter(description = "年度", required = true, example = "2024") @RequestParam Integer year,
            @Parameter(description = "月份", required = true, example = "6") @RequestParam Integer month) {
        return R.ok(service.interpolateMissing(year, month));
    }

    @DeleteMapping("/period/{period}")
    @Operation(summary = "删除某期间全部活动数据(慎用)")
    public R<Void> deleteByPeriod(@PathVariable String period) {
        service.deleteByPeriod(period);
        return R.ok();
    }

    private List<ActivityData> parseExcel(MultipartFile file, String period) throws IOException {
        List<ActivityData> list = new ArrayList<>();
        try (var in = file.getInputStream();
             var wb = org.apache.poi.ss.usermodel.WorkbookFactory.create(in)) {
            var sheet = wb.getSheetAt(0);
            var it = sheet.rowIterator();
            if (it.hasNext()) it.next();
            int rowNum = 1;
            while (it.hasNext()) {
                var row = it.next();
                rowNum++;
                try {
                    ActivityData d = new ActivityData();
                    d.setSourceCode(getCellString(row, 0));
                    d.setRawValue(getCellDecimal(row, 2));
                    d.setInputUnit(getCellString(row, 3));
                    d.setNetCalorificValue(getCellDecimal(row, 4));
                    d.setCarbonContent(getCellDecimal(row, 5));
                    d.setOxidationRate(getCellDecimal(row, 6));
                    String[] ym = period.split("-");
                    d.setPeriodYear(Integer.parseInt(ym[0]));
                    d.setPeriodMonth(Integer.parseInt(ym[1]));
                    d.setImportedAt(Instant.now());
                    list.add(d);
                } catch (Exception e) {
                    if (list.size() < 100) {
                        list.add(new ActivityData());
                    }
                }
            }
        }
        return list;
    }

    private String getCellString(org.apache.poi.ss.usermodel.Row row, int idx) {
        var c = row.getCell(idx);
        if (c == null) return null;
        return switch (c.getCellType()) {
            case STRING -> c.getStringCellValue();
            case NUMERIC -> String.valueOf(c.getNumericCellValue());
            default -> null;
        };
    }

    private BigDecimal getCellDecimal(org.apache.poi.ss.usermodel.Row row, int idx) {
        var c = row.getCell(idx);
        if (c == null) return null;
        return switch (c.getCellType()) {
            case NUMERIC -> BigDecimal.valueOf(c.getNumericCellValue());
            case STRING -> {
                try {
                    yield new BigDecimal(c.getStringCellValue().trim());
                } catch (Exception e) {
                    yield null;
                }
            }
            default -> null;
        };
    }
}
