package storage

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func setupTestDB(t *testing.T) *Database {
	t.Helper()
	ResetForTest()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	db, err := Init(dbPath)
	if err != nil {
		t.Fatalf("Failed to init test DB: %v", err)
	}
	t.Cleanup(func() {
		db.Close()
		os.RemoveAll(dbPath)
		ResetForTest()
	})
	return db
}

func TestInitAndClose(t *testing.T) {
	ResetForTest()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test_close.db")
	db, err := Init(dbPath)
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	if db == nil {
		t.Fatal("DB is nil")
	}
	if err := db.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}
}

func TestInitTables(t *testing.T) {
	db := setupTestDB(t)

	var tableNames = []string{"price_records", "monitor_tasks", "crawl_stats", "alert_logs"}
	for _, name := range tableNames {
		var count int
		row := db.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", name)
		if err := row.Scan(&count); err != nil {
			t.Fatalf("Table check failed for %s: %v", name, err)
		}
		if count != 1 {
			t.Errorf("Table %s not found, count=%d", name, count)
		}
	}
}

func TestSaveAndGetPriceRecord(t *testing.T) {
	db := setupTestDB(t)

	now := time.Now()
	record := &PriceRecord{
		SKUId:         "SKU0001",
		SKUName:       "测试商品",
		Brand:         "花王",
		Category:      "纸尿裤",
		SiteId:        "tmall",
		SiteName:      "天猫",
		PriceOriginal: 199.0,
		PricePromo:    128.0,
		PriceMember:   118.0,
		PriceFinal:    118.0,
		Currency:      "CNY",
		Stock:         "有货",
		URL:           "https://example.com/item/123",
		Title:         "测试标题",
		CrawledAt:     now,
		Hash:          "testhash001",
	}

	id, err := db.SavePriceRecord(record)
	if err != nil {
		t.Fatalf("SavePriceRecord failed: %v", err)
	}
	if id <= 0 {
		t.Error("SavePriceRecord should return positive id")
	}

	latest, err := db.GetLatestPrice("SKU0001", "tmall")
	if err != nil {
		t.Fatalf("GetLatestPrice failed: %v", err)
	}
	if latest == nil {
		t.Fatal("Expected latest record")
	}
	if latest.SKUId != "SKU0001" {
		t.Errorf("Expected SKU0001, got %s", latest.SKUId)
	}
	if latest.PriceFinal != 118.0 {
		t.Errorf("Expected PriceFinal 118.0, got %f", latest.PriceFinal)
	}
	if latest.Brand != "花王" {
		t.Errorf("Expected Brand 花王, got %s", latest.Brand)
	}
}

func TestSavePriceRecordUniqueConstraint(t *testing.T) {
	db := setupTestDB(t)

	now := time.Now()
	for i := 0; i < 3; i++ {
		record := &PriceRecord{
			SKUId:     "SKU0001",
			SKUName:   "测试",
			Brand:     "测试",
			Category:  "测试",
			SiteId:    "tmall",
			SiteName:  "天猫",
			PriceFinal: 128.0,
			CrawledAt: now,
			Hash:      "uniquehash001",
		}
		_, err := db.SavePriceRecord(record)
		if err != nil {
			t.Fatalf("SavePriceRecord iteration %d failed: %v", i, err)
		}
	}
}

func TestSavePriceRecordsBatch(t *testing.T) {
	db := setupTestDB(t)

	now := time.Now()
	var records []*PriceRecord
	for i := 0; i < 10; i++ {
		records = append(records, &PriceRecord{
			SKUId:     "SKU0001",
			SKUName:   "测试批量",
			Brand:     "测试",
			Category:  "测试",
			SiteId:    "tmall",
			SiteName:  "天猫",
			PriceFinal: 100.0 + float64(i),
			CrawledAt: now,
			Hash:      "batchhash" + string(rune('0'+i)),
		})
	}

	inserted, err := db.SavePriceRecordsBatch(records)
	if err != nil {
		t.Fatalf("SavePriceRecordsBatch failed: %v", err)
	}
	if inserted != len(records) {
		t.Errorf("Expected %d inserted, got %d", len(records), inserted)
	}
}

func TestSavePriceRecordsBatchEmpty(t *testing.T) {
	db := setupTestDB(t)
	inserted, err := db.SavePriceRecordsBatch(nil)
	if err != nil {
		t.Fatal(err)
	}
	if inserted != 0 {
		t.Errorf("Expected 0 inserted, got %d", inserted)
	}
}

func TestGetPriceHistory(t *testing.T) {
	db := setupTestDB(t)

	now := time.Now()
	for i := 0; i < 5; i++ {
		record := &PriceRecord{
			SKUId:     "SKU0001",
			SKUName:   "测试",
			Brand:     "测试",
			Category:  "测试",
			SiteId:    "tmall",
			SiteName:  "天猫",
			PriceFinal: 100.0 + float64(i),
			CrawledAt: now.Add(-time.Duration(i) * 24 * time.Hour),
			Hash:      "historyhash" + string(rune('0'+i)),
		}
		if _, err := db.SavePriceRecord(record); err != nil {
			t.Fatal(err)
		}
	}

	start := now.Add(-3 * 24 * time.Hour)
	end := now
	records, err := db.GetPriceHistory("SKU0001", "tmall", start, end)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) == 0 {
		t.Error("Expected at least some records in time range")
	}
}

func TestGetAllLatestPrices(t *testing.T) {
	db := setupTestDB(t)

	now := time.Now()
	records := []*PriceRecord{
		{SKUId: "SKU0001", SiteId: "tmall", PriceFinal: 100, CrawledAt: now, Hash: "alllatest1"},
		{SKUId: "SKU0001", SiteId: "jd", PriceFinal: 95, CrawledAt: now, Hash: "alllatest2"},
		{SKUId: "SKU0002", SiteId: "tmall", PriceFinal: 200, CrawledAt: now, Hash: "alllatest3"},
	}
	for _, r := range records {
		r.SKUName = "测试"
		r.SiteName = "测试"
		if _, err := db.SavePriceRecord(r); err != nil {
			t.Fatal(err)
		}
	}

	all, err := db.GetAllLatestPrices()
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 3 {
		t.Errorf("Expected 3 latest prices, got %d", len(all))
	}
}

func TestSaveCrawlStats(t *testing.T) {
	db := setupTestDB(t)

	stats := &CrawlStats{
		TotalCount:    100,
		SuccessCount:  95,
		FailedCount:   5,
		StartTime:     time.Now().Add(-10 * time.Minute),
		EndTime:       time.Now(),
		Duration:      10 * time.Minute,
		ErrorMessages: []string{"error1", "error2", "error3"},
	}

	err := db.SaveCrawlStats(stats)
	if err != nil {
		t.Fatalf("SaveCrawlStats failed: %v", err)
	}
}

func TestSaveCrawlStatsWithErrorMessages(t *testing.T) {
	db := setupTestDB(t)

	errorMsgs := []string{
		"timeout connecting to server",
		"captcha required",
		"invalid selector not found",
	}

	stats := &CrawlStats{
		TotalCount:    10,
		SuccessCount:  7,
		FailedCount:   3,
		StartTime:     time.Now().Add(-5 * time.Minute),
		EndTime:       time.Now(),
		Duration:      5 * time.Minute,
		ErrorMessages: errorMsgs,
	}

	err := db.SaveCrawlStats(stats)
	if err != nil {
		t.Fatalf("SaveCrawlStats failed: %v", err)
	}

	rows, err := db.db.Query("SELECT error_messages FROM crawl_stats ORDER BY id DESC LIMIT 1")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	if rows.Next() {
		var msg string
		if err := rows.Scan(&msg); err != nil {
			t.Fatal(err)
		}

		if !strings.Contains(msg, "timeout connecting") {
			t.Errorf("error_messages should contain timeout, got %q", msg)
		}
		if !strings.Contains(msg, "captcha") {
			t.Errorf("error_messages should contain captcha, got %q", msg)
		}
		if !strings.Contains(msg, "invalid selector") {
			t.Errorf("error_messages should contain invalid selector, got %q", msg)
		}
		if !strings.Contains(msg, " ||| ") {
			t.Errorf("error_messages should use ||| separator, got %q", msg)
		}
	} else {
		t.Error("Expected crawl_stats row not found")
	}
}

func TestSaveCrawlStatsEmptyErrors(t *testing.T) {
	db := setupTestDB(t)

	stats := &CrawlStats{
		TotalCount:    5,
		SuccessCount:  5,
		FailedCount:   0,
		StartTime:     time.Now().Add(-time.Minute),
		EndTime:       time.Now(),
		Duration:      time.Minute,
		ErrorMessages: []string{},
	}

	err := db.SaveCrawlStats(stats)
	if err != nil {
		t.Fatalf("SaveCrawlStats failed: %v", err)
	}
}

func TestLogAlert(t *testing.T) {
	db := setupTestDB(t)

	err := db.LogAlert("SKU0001", "tmall", 199.0, 128.0, -0.3567, "PRICE_DROP")
	if err != nil {
		t.Fatalf("LogAlert failed: %v", err)
	}
}

func TestSaveAndGetMonitorTask(t *testing.T) {
	db := setupTestDB(t)

	task := &MonitorTask{
		SKUId:    "SKU0001",
		SiteId:   "tmall",
		Keyword:  "花王纸尿裤",
		CronExpr: "0 * * * *",
		Enabled:  true,
	}

	id, err := db.SaveMonitorTask(task)
	if err != nil {
		t.Fatalf("SaveMonitorTask failed: %v", err)
	}
	if id <= 0 {
		t.Error("SaveMonitorTask should return positive id")
	}

	tasks, err := db.GetMonitorTasks()
	if err != nil {
		t.Fatalf("GetMonitorTasks failed: %v", err)
	}
	if len(tasks) == 0 {
		t.Error("Expected at least 1 task")
	}
	found := false
	for _, tk := range tasks {
		if tk.SKUId == "SKU0001" && tk.SiteId == "tmall" {
			found = true
			if !tk.Enabled {
				t.Error("Task should be enabled")
			}
			if tk.CronExpr != "0 * * * *" {
				t.Errorf("CronExpr mismatch: got %s", tk.CronExpr)
			}
		}
	}
	if !found {
		t.Error("Expected task not found in list")
	}
}

func TestUpdateTaskRunTime(t *testing.T) {
	db := setupTestDB(t)

	task := &MonitorTask{
		SKUId:    "SKU0001",
		SiteId:   "tmall",
		Keyword:  "测试",
		CronExpr: "0 * * * *",
		Enabled:  true,
	}
	id, err := db.SaveMonitorTask(task)
	if err != nil {
		t.Fatal(err)
	}

	lastRun := time.Now()
	nextRun := lastRun.Add(time.Hour)
	if err := db.UpdateTaskRunTime(id, lastRun, nextRun); err != nil {
		t.Fatalf("UpdateTaskRunTime failed: %v", err)
	}
}

func TestGetStatistics(t *testing.T) {
	db := setupTestDB(t)

	now := time.Now()
	for i := 0; i < 5; i++ {
		record := &PriceRecord{
			SKUId:     "SKU0001",
			SKUName:   "统计测试",
			Brand:     "测试",
			Category:  "测试",
			SiteId:    "tmall",
			SiteName:  "天猫",
			PriceFinal: 100.0 + float64(i),
			CrawledAt: now,
			Hash:      "statshash" + string(rune('0'+i)),
		}
		if _, err := db.SavePriceRecord(record); err != nil {
			t.Fatal(err)
		}
	}

	stats, err := db.GetStatistics(7)
	if err != nil {
		t.Fatalf("GetStatistics failed: %v", err)
	}
	if stats == nil {
		t.Fatal("Stats should not be nil")
	}

	uniqueSkus, ok := stats["unique_skus"]
	if !ok {
		t.Error("unique_skus not in stats")
	}
	if uniqueSkus.(int64) < 1 {
		t.Errorf("Expected at least 1 unique SKU, got %v", uniqueSkus)
	}
}

func TestPriceRecordFields(t *testing.T) {
	record := &PriceRecord{
		SKUId:         "SKU0001",
		SKUName:       "测试商品名称",
		Brand:         "测试品牌",
		Category:      "测试分类",
		SiteId:        "test",
		SiteName:      "测试站点",
		PriceOriginal: 199.99,
		PricePromo:    128.50,
		PriceMember:   118.00,
		PriceFinal:    118.00,
		Currency:      "CNY",
		Stock:         "有货",
		URL:           "https://example.com",
	}
	_ = record
}

func TestCrawlStatsFields(t *testing.T) {
	stats := &CrawlStats{
		TaskId:        100,
		TotalCount:    800,
		SuccessCount:  750,
		FailedCount:   50,
		StartTime:     time.Now(),
		EndTime:       time.Now(),
		Duration:      15 * time.Minute,
		ErrorMessages: []string{"error1", "error2"},
	}
	_ = stats
}

func TestGetLatestPriceNotFound(t *testing.T) {
	db := setupTestDB(t)
	latest, err := db.GetLatestPrice("NONEXISTENT", "tmall")
	if err != nil {
		t.Fatal(err)
	}
	if latest != nil {
		t.Error("Expected nil for nonexistent SKU")
	}
}
