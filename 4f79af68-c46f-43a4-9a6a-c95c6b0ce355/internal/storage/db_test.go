package storage

import (
	"path/filepath"
	"testing"
	"time"
)

func newTestDB(t *testing.T) *Database {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	db, err := NewDatabase(dbPath)
	if err != nil {
		t.Fatalf("NewDatabase() error: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestNewDatabase(t *testing.T) {
	db := newTestDB(t)
	if db == nil {
		t.Fatal("NewDatabase() returned nil")
	}
}

func TestNewDatabase_InvalidPath(t *testing.T) {
	_, err := NewDatabase("/nonexistent/deep/nested/path/test.db")
	if err == nil {
		t.Error("NewDatabase with invalid path should return error")
	}
}

func TestInsertRecord(t *testing.T) {
	db := newTestDB(t)
	record := &PavementRecord{
		RouteID:          "G108",
		StartStation:     1000,
		EndStation:       2000,
		SectionLength:    1.0,
		IRI:              2.5,
		RutDepth:         8.0,
		CrackDensity:     5.0,
		TrafficVolume:    30000,
		Importance:       2,
		MaintenanceCenter: "养护一中心",
		DetectDate:       time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC),
		BatchID:         "Q1-2024",
	}

	id, err := db.InsertRecord(nil, record)
	if err != nil {
		t.Fatalf("InsertRecord() error: %v", err)
	}
	if id <= 0 {
		t.Errorf("InsertRecord() id = %d, want > 0", id)
	}
}

func TestBatchInsertRecords(t *testing.T) {
	db := newTestDB(t)
	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 2.5, RutDepth: 8.0, CrackDensity: 5.0, TrafficVolume: 30000, Importance: 2, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
		{RouteID: "G108", StartStation: 2000, EndStation: 3000, SectionLength: 1.0, IRI: 3.0, RutDepth: 10.0, CrackDensity: 8.0, TrafficVolume: 25000, Importance: 1.5, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
		{RouteID: "S305", StartStation: 5000, EndStation: 6000, SectionLength: 1.0, IRI: 4.0, RutDepth: 12.0, CrackDensity: 10.0, TrafficVolume: 20000, Importance: 1, MaintenanceCenter: "养护三中心", DetectDate: time.Date(2024, 1, 16, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
	}

	inserted, err := db.BatchInsertRecords(records)
	if err != nil {
		t.Fatalf("BatchInsertRecords() error: %v", err)
	}
	if inserted != 3 {
		t.Errorf("BatchInsertRecords() inserted = %d, want 3", inserted)
	}
}

func TestQueryRecords_All(t *testing.T) {
	db := newTestDB(t)
	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 2.5, RutDepth: 8.0, CrackDensity: 5.0, TrafficVolume: 30000, Importance: 2, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
		{RouteID: "S305", StartStation: 5000, EndStation: 6000, SectionLength: 1.0, IRI: 4.0, RutDepth: 12.0, CrackDensity: 10.0, TrafficVolume: 20000, Importance: 1, MaintenanceCenter: "养护三中心", DetectDate: time.Date(2024, 1, 16, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
	}
	db.BatchInsertRecords(records)

	results, err := db.QueryRecords(&QueryCondition{Limit: 100})
	if err != nil {
		t.Fatalf("QueryRecords() error: %v", err)
	}
	if len(results) != 2 {
		t.Errorf("QueryRecords() returned %d records, want 2", len(results))
	}
}

func TestQueryRecords_ByRouteID(t *testing.T) {
	db := newTestDB(t)
	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 2.5, RutDepth: 8.0, CrackDensity: 5.0, TrafficVolume: 30000, Importance: 2, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
		{RouteID: "S305", StartStation: 5000, EndStation: 6000, SectionLength: 1.0, IRI: 4.0, RutDepth: 12.0, CrackDensity: 10.0, TrafficVolume: 20000, Importance: 1, MaintenanceCenter: "养护三中心", DetectDate: time.Date(2024, 1, 16, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
	}
	db.BatchInsertRecords(records)

	results, err := db.QueryRecords(&QueryCondition{RouteID: "G108", Limit: 100})
	if err != nil {
		t.Fatalf("QueryRecords() error: %v", err)
	}
	if len(results) != 1 {
		t.Errorf("QueryRecords(G108) returned %d records, want 1", len(results))
	}
	if len(results) > 0 && results[0].RouteID != "G108" {
		t.Errorf("RouteID = %q, want %q", results[0].RouteID, "G108")
	}
}

func TestQueryRecords_ByGrade(t *testing.T) {
	db := newTestDB(t)
	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 1.2, RutDepth: 3.0, CrackDensity: 0.5, TrafficVolume: 30000, Importance: 3, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024", TotalScore: 95, DiseaseGrade: "优"},
		{RouteID: "S305", StartStation: 5000, EndStation: 6000, SectionLength: 1.0, IRI: 8.0, RutDepth: 25.0, CrackDensity: 20.0, TrafficVolume: 20000, Importance: 1, MaintenanceCenter: "养护三中心", DetectDate: time.Date(2024, 1, 16, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024", TotalScore: 30, DiseaseGrade: "差"},
	}
	db.BatchInsertRecords(records)

	results, err := db.QueryRecords(&QueryCondition{Grade: "差", Limit: 100})
	if err != nil {
		t.Fatalf("QueryRecords() error: %v", err)
	}
	if len(results) != 1 {
		t.Errorf("QueryRecords(差) returned %d records, want 1", len(results))
	}
}

func TestQueryRecords_Limit(t *testing.T) {
	db := newTestDB(t)
	records := make([]*PavementRecord, 10)
	for i := range records {
		records[i] = &PavementRecord{
			RouteID: "G108", StartStation: i * 1000, EndStation: (i + 1) * 1000,
			SectionLength: 1.0, IRI: 2.5, RutDepth: 8.0, CrackDensity: 5.0,
			TrafficVolume: 30000, Importance: 2, MaintenanceCenter: "养护一中心",
			DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024",
		}
	}
	db.BatchInsertRecords(records)

	results, err := db.QueryRecords(&QueryCondition{Limit: 5})
	if err != nil {
		t.Fatalf("QueryRecords() error: %v", err)
	}
	if len(results) != 5 {
		t.Errorf("QueryRecords(limit=5) returned %d records, want 5", len(results))
	}
}

func TestUpdateRecordClassify(t *testing.T) {
	db := newTestDB(t)
	record := &PavementRecord{
		RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0,
		IRI: 2.5, RutDepth: 8.0, CrackDensity: 5.0,
		TrafficVolume: 30000, Importance: 2, MaintenanceCenter: "养护一中心",
		DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024",
	}
	id, _ := db.InsertRecord(nil, record)

	err := db.UpdateRecordClassify(id, 80, 90, 90, 85.0, "良")
	if err != nil {
		t.Fatalf("UpdateRecordClassify() error: %v", err)
	}

	results, _ := db.QueryRecords(&QueryCondition{Limit: 100})
	if len(results) > 0 && results[0].DiseaseGrade != "良" {
		t.Errorf("DiseaseGrade after update = %q, want %q", results[0].DiseaseGrade, "良")
	}
}

func TestUpdatePriorityAndCost(t *testing.T) {
	db := newTestDB(t)
	record := &PavementRecord{
		RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0,
		IRI: 2.5, RutDepth: 8.0, CrackDensity: 5.0,
		TrafficVolume: 30000, Importance: 2, MaintenanceCenter: "养护一中心",
		DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024",
	}
	id, _ := db.InsertRecord(nil, record)

	err := db.UpdatePriorityAndCost(id, 75.5, 594.0)
	if err != nil {
		t.Fatalf("UpdatePriorityAndCost() error: %v", err)
	}

	topRecords, _ := db.GetTopPriorityRecords(10)
	if len(topRecords) > 0 && topRecords[0].PriorityScore != 75.5 {
		t.Errorf("PriorityScore after update = %.2f, want 75.50", topRecords[0].PriorityScore)
	}
}

func TestGetTopPriorityRecords(t *testing.T) {
	db := newTestDB(t)
	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 8.0, RutDepth: 25.0, CrackDensity: 20.0, TrafficVolume: 40000, Importance: 3, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024", PriorityScore: 80, EstimatedCost: 600},
		{RouteID: "S305", StartStation: 5000, EndStation: 6000, SectionLength: 1.0, IRI: 2.0, RutDepth: 5.0, CrackDensity: 2.0, TrafficVolume: 10000, Importance: 1, MaintenanceCenter: "养护三中心", DetectDate: time.Date(2024, 1, 16, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024", PriorityScore: 30, EstimatedCost: 100},
	}
	db.BatchInsertRecords(records)

	top, err := db.GetTopPriorityRecords(5)
	if err != nil {
		t.Fatalf("GetTopPriorityRecords() error: %v", err)
	}
	if len(top) != 2 {
		t.Errorf("GetTopPriorityRecords(5) returned %d, want 2", len(top))
	}
	if len(top) > 0 && top[0].PriorityScore < top[1].PriorityScore {
		t.Errorf("Records not sorted by priority desc")
	}
}

func TestDeleteByBatchID(t *testing.T) {
	db := newTestDB(t)
	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 2.5, RutDepth: 8.0, CrackDensity: 5.0, TrafficVolume: 30000, Importance: 2, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
		{RouteID: "S305", StartStation: 5000, EndStation: 6000, SectionLength: 1.0, IRI: 4.0, RutDepth: 12.0, CrackDensity: 10.0, TrafficVolume: 20000, Importance: 1, MaintenanceCenter: "养护三中心", DetectDate: time.Date(2024, 1, 16, 0, 0, 0, 0, time.UTC), BatchID: "Q2-2024"},
	}
	db.BatchInsertRecords(records)

	deleted, err := db.DeleteByBatchID("Q1-2024")
	if err != nil {
		t.Fatalf("DeleteByBatchID() error: %v", err)
	}
	if deleted != 1 {
		t.Errorf("DeleteByBatchID() deleted = %d, want 1", deleted)
	}

	count, _ := db.GetAllRecordsCount()
	if count != 1 {
		t.Errorf("After delete, count = %d, want 1", count)
	}
}

func TestDeleteByDateRange(t *testing.T) {
	db := newTestDB(t)
	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 2.5, RutDepth: 8.0, CrackDensity: 5.0, TrafficVolume: 30000, Importance: 2, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
		{RouteID: "S305", StartStation: 5000, EndStation: 6000, SectionLength: 1.0, IRI: 4.0, RutDepth: 12.0, CrackDensity: 10.0, TrafficVolume: 20000, Importance: 1, MaintenanceCenter: "养护三中心", DetectDate: time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q2-2024"},
	}
	db.BatchInsertRecords(records)

	startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 3, 31, 0, 0, 0, 0, time.UTC)
	deleted, err := db.DeleteByDateRange(startDate, endDate)
	if err != nil {
		t.Fatalf("DeleteByDateRange() error: %v", err)
	}
	if deleted != 1 {
		t.Errorf("DeleteByDateRange() deleted = %d, want 1", deleted)
	}
}

func TestGetAllRecordsCount(t *testing.T) {
	db := newTestDB(t)

	count, err := db.GetAllRecordsCount()
	if err != nil {
		t.Fatalf("GetAllRecordsCount() error: %v", err)
	}
	if count != 0 {
		t.Errorf("GetAllRecordsCount() on empty DB = %d, want 0", count)
	}

	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 2.5, RutDepth: 8.0, CrackDensity: 5.0, TrafficVolume: 30000, Importance: 2, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
	}
	db.BatchInsertRecords(records)

	count, _ = db.GetAllRecordsCount()
	if count != 1 {
		t.Errorf("GetAllRecordsCount() after insert = %d, want 1", count)
	}
}

func TestGetStatisticsByRoute(t *testing.T) {
	db := newTestDB(t)
	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 1.2, RutDepth: 3.0, CrackDensity: 0.5, TrafficVolume: 30000, Importance: 3, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024", TotalScore: 95, DiseaseGrade: "优"},
		{RouteID: "G108", StartStation: 2000, EndStation: 3000, SectionLength: 1.0, IRI: 8.0, RutDepth: 25.0, CrackDensity: 20.0, TrafficVolume: 25000, Importance: 2, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024", TotalScore: 30, DiseaseGrade: "差"},
		{RouteID: "S305", StartStation: 5000, EndStation: 6000, SectionLength: 1.0, IRI: 4.0, RutDepth: 12.0, CrackDensity: 10.0, TrafficVolume: 20000, Importance: 1, MaintenanceCenter: "养护三中心", DetectDate: time.Date(2024, 1, 16, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024", TotalScore: 60, DiseaseGrade: "中"},
	}
	db.BatchInsertRecords(records)

	stats, err := db.GetStatisticsByRoute()
	if err != nil {
		t.Fatalf("GetStatisticsByRoute() error: %v", err)
	}
	if len(stats) != 2 {
		t.Errorf("GetStatisticsByRoute() returned %d groups, want 2", len(stats))
	}
}

func TestGetStatisticsByGrade(t *testing.T) {
	db := newTestDB(t)
	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 1.2, RutDepth: 3.0, CrackDensity: 0.5, TrafficVolume: 30000, Importance: 3, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024", TotalScore: 95, DiseaseGrade: "优"},
		{RouteID: "S305", StartStation: 5000, EndStation: 6000, SectionLength: 1.0, IRI: 8.0, RutDepth: 25.0, CrackDensity: 20.0, TrafficVolume: 20000, Importance: 1, MaintenanceCenter: "养护三中心", DetectDate: time.Date(2024, 1, 16, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024", TotalScore: 30, DiseaseGrade: "差"},
	}
	db.BatchInsertRecords(records)

	stats, err := db.GetStatisticsByGrade()
	if err != nil {
		t.Fatalf("GetStatisticsByGrade() error: %v", err)
	}
	if len(stats) < 2 {
		t.Errorf("GetStatisticsByGrade() returned %d groups, want >= 2", len(stats))
	}
}

func TestGetTotalMileage(t *testing.T) {
	db := newTestDB(t)
	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 2.5, RutDepth: 8.0, CrackDensity: 5.0, TrafficVolume: 30000, Importance: 2, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
		{RouteID: "S305", StartStation: 5000, EndStation: 6000, SectionLength: 1.0, IRI: 4.0, RutDepth: 12.0, CrackDensity: 10.0, TrafficVolume: 20000, Importance: 1, MaintenanceCenter: "养护三中心", DetectDate: time.Date(2024, 1, 16, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
	}
	db.BatchInsertRecords(records)

	mileage, err := db.GetTotalMileage()
	if err != nil {
		t.Fatalf("GetTotalMileage() error: %v", err)
	}
	if mileage != 2.0 {
		t.Errorf("GetTotalMileage() = %.2f, want 2.00", mileage)
	}
}

func TestQueryRecords_ByDateRange(t *testing.T) {
	db := newTestDB(t)
	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 2.5, RutDepth: 8.0, CrackDensity: 5.0, TrafficVolume: 30000, Importance: 2, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
		{RouteID: "S305", StartStation: 5000, EndStation: 6000, SectionLength: 1.0, IRI: 4.0, RutDepth: 12.0, CrackDensity: 10.0, TrafficVolume: 20000, Importance: 1, MaintenanceCenter: "养护三中心", DetectDate: time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q2-2024"},
	}
	db.BatchInsertRecords(records)

	startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 3, 31, 0, 0, 0, 0, time.UTC)
	results, err := db.QueryRecords(&QueryCondition{StartDate: &startDate, EndDate: &endDate, Limit: 100})
	if err != nil {
		t.Fatalf("QueryRecords() error: %v", err)
	}
	if len(results) != 1 {
		t.Errorf("QueryRecords(date range) returned %d records, want 1", len(results))
	}
}

func TestQueryRecords_ByStationRange(t *testing.T) {
	db := newTestDB(t)
	records := []*PavementRecord{
		{RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, IRI: 2.5, RutDepth: 8.0, CrackDensity: 5.0, TrafficVolume: 30000, Importance: 2, MaintenanceCenter: "养护一中心", DetectDate: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
		{RouteID: "G108", StartStation: 5000, EndStation: 6000, SectionLength: 1.0, IRI: 4.0, RutDepth: 12.0, CrackDensity: 10.0, TrafficVolume: 20000, Importance: 1, MaintenanceCenter: "养护三中心", DetectDate: time.Date(2024, 1, 16, 0, 0, 0, 0, time.UTC), BatchID: "Q1-2024"},
	}
	db.BatchInsertRecords(records)

	start := 500
	end := 3000
	results, err := db.QueryRecords(&QueryCondition{StartStation: &start, EndStation: &end, Limit: 100})
	if err != nil {
		t.Fatalf("QueryRecords() error: %v", err)
	}
	if len(results) != 1 {
		t.Errorf("QueryRecords(station range) returned %d records, want 1", len(results))
	}
}

func TestClose(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test_close.db")
	db, err := NewDatabase(dbPath)
	if err != nil {
		t.Fatalf("NewDatabase() error: %v", err)
	}
	err = db.Close()
	if err != nil {
		t.Errorf("Close() error: %v", err)
	}
}
