package store

import (
	"fmt"
	"testing"

	"bankrupt-monitor/internal/model"
	"bankrupt-monitor/internal/parser"

	"go.uber.org/zap"
)

func boolPtr(b bool) *bool { return &b }

func BenchmarkQueryCases(b *testing.B) {
	log, _ := zap.NewDevelopment()
	db, err := NewStore(":memory:", log)
	if err != nil {
		b.Fatal(err)
	}
	defer db.Close()

	for i := 0; i < 5000; i++ {
		c := &model.Case{
			CaseNumber:  fmt.Sprintf("(2024)京破%d号", i),
			Debtor:      fmt.Sprintf("债务人%d有限公司", i),
			Court:       "北京市高级人民法院",
			CourtLevel:  model.CourtLevelHigh,
			IsRead:      false,
			HitSubscription: i%100 == 0,
		}
		parser.NormalizeCase(c)
		_, _ = db.UpsertCase(c)
	}

	q := &CaseQuery{
		Keyword:         "公司",
		HitSubscription: boolPtr(true),
		PageSize:        50,
		Page:            1,
	}

	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		_, _, err := db.QueryCases(q)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkQueryCasesDeepPagination(b *testing.B) {
	log, _ := zap.NewDevelopment()
	db, err := NewStore(":memory:", log)
	if err != nil {
		b.Fatal(err)
	}
	defer db.Close()

	for i := 0; i < 5000; i++ {
		c := &model.Case{
			CaseNumber:  fmt.Sprintf("(2024)京破%d号", i),
			Debtor:      fmt.Sprintf("债务人%d有限公司", i),
			Court:       "北京市高级人民法院",
			CourtLevel:  model.CourtLevelHigh,
		}
		parser.NormalizeCase(c)
		_, _ = db.UpsertCase(c)
	}

	pages := []int{1, 10, 50, 100}
	for _, page := range pages {
		b.Run(fmt.Sprintf("page_%d", page), func(b *testing.B) {
			q := &CaseQuery{
				PageSize: 20,
				Page:     page,
			}
			b.ResetTimer()
			for n := 0; n < b.N; n++ {
				_, _, err := db.QueryCases(q)
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func BenchmarkUpsertCase(b *testing.B) {
	log, _ := zap.NewDevelopment()
	db, err := NewStore(":memory:", log)
	if err != nil {
		b.Fatal(err)
	}
	defer db.Close()

	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		c := &model.Case{
			CaseNumber: fmt.Sprintf("(2024)京破%d号", n),
			Debtor:     fmt.Sprintf("债务人%d有限公司", n),
			Court:      "北京市高级人民法院",
			CourtLevel: model.CourtLevelHigh,
		}
		parser.NormalizeCase(c)
		_, err := db.UpsertCase(c)
		if err != nil {
			b.Fatal(err)
		}
	}
}
