package store

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"go.etcd.io/bbolt"
	"go.uber.org/zap"

	"drugvigil/config"
)

const (
	BucketRecords    = "records"
	BucketCrawlState = "crawl_state"
	BucketAlerts     = "alerts"
	BucketStats      = "stats"
)

type SecurityRecord struct {
	ID            string    `json:"id"`
	SourceAgency  string    `json:"source_agency"`
	SourceCode    string    `json:"source_code"`
	ReportID      string    `json:"report_id"`
	DrugName      string    `json:"drug_name"`
	GenericName   string    `json:"generic_name"`
	AdverseEvent  string    `json:"adverse_event"`
	Severity      string    `json:"severity"`
	Frequency     string    `json:"frequency"`
	PublishedDate time.Time `json:"published_date"`
	SourceURL     string    `json:"source_url"`
	Summary       string    `json:"summary"`
	Language      string    `json:"language"`
	ContentHash   string    `json:"content_hash"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	IsNew         bool      `json:"-"`
	IsModified    bool      `json:"-"`
}

type CrawlState struct {
	SiteCode      string    `json:"site_code"`
	LastPage      int       `json:"last_page"`
	LastSuccess   time.Time `json:"last_success"`
	LastRecordID  string    `json:"last_record_id"`
	TotalRecords  int64     `json:"total_records"`
	FailCount     int       `json:"fail_count"`
	LastError     string    `json:"last_error"`
}

type AlertRecord struct {
	ID          string        `json:"id"`
	RecordID    string        `json:"record_id"`
	AlertLevel  string        `json:"alert_level"`
	SentAt      time.Time     `json:"sent_at"`
	Channels    []string      `json:"channels"`
	Content     string        `json:"content"`
}

type SiteStats struct {
	SiteCode    string    `json:"site_code"`
	TodayCount  int64     `json:"today_count"`
	WeekCount   int64     `json:"week_count"`
	TotalCount  int64     `json:"total_count"`
	LastCrawl   time.Time `json:"last_crawl"`
	AvgDuration time.Duration `json:"avg_duration"`
}

type Store struct {
	db     *bbolt.DB
	logger *zap.Logger
	path   string
}

func New(cfg *config.Config, logger *zap.Logger) (*Store, error) {
	dbPath := cfg.Database.Path
	if err := ensureDir(filepath.Dir(dbPath)); err != nil {
		return nil, fmt.Errorf("ensure db dir: %w", err)
	}

	db, err := bbolt.Open(dbPath, 0600, &bbolt.Options{Timeout: 5 * time.Second})
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	err = db.Update(func(tx *bbolt.Tx) error {
		for _, bucket := range []string{BucketRecords, BucketCrawlState, BucketAlerts, BucketStats} {
			if _, err := tx.CreateBucketIfNotExists([]byte(bucket)); err != nil {
				return fmt.Errorf("create bucket %s: %w", bucket, err)
			}
		}
		return nil
	})
	if err != nil {
		db.Close()
		return nil, err
	}

	return &Store{
		db:     db,
		logger: logger,
		path:   dbPath,
	}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func ComputeRecordID(sourceCode, reportID string, publishedDate time.Time) string {
	data := fmt.Sprintf("%s:%s:%s", sourceCode, reportID, publishedDate.Format(time.RFC3339))
	h := sha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:16])
}

func ComputeContentHash(r *SecurityRecord) string {
	data := fmt.Sprintf("%s:%s:%s:%s", r.DrugName, r.AdverseEvent, r.Severity, r.Summary)
	h := sha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:])
}

func (s *Store) SaveRecord(r *SecurityRecord) (bool, bool, error) {
	var isNew, isModified bool

	r.ID = ComputeRecordID(r.SourceCode, r.ReportID, r.PublishedDate)
	newHash := ComputeContentHash(r)
	now := time.Now()

	err := s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketRecords))
		existing := b.Get([]byte(r.ID))

		if existing == nil {
			isNew = true
			r.CreatedAt = now
			r.UpdatedAt = now
			r.ContentHash = newHash
			data, err := json.Marshal(r)
			if err != nil {
				return err
			}
			return b.Put([]byte(r.ID), data)
		}

		var oldRecord SecurityRecord
		if err := json.Unmarshal(existing, &oldRecord); err != nil {
			return err
		}

		if oldRecord.ContentHash != newHash {
			isModified = true
			r.CreatedAt = oldRecord.CreatedAt
			r.UpdatedAt = now
			r.ContentHash = newHash
			data, err := json.Marshal(r)
			if err != nil {
				return err
			}
			return b.Put([]byte(r.ID), data)
		}

		return nil
	})

	r.IsNew = isNew
	r.IsModified = isModified
	return isNew, isModified, err
}

func (s *Store) GetRecord(id string) (*SecurityRecord, error) {
	var r *SecurityRecord
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketRecords))
		data := b.Get([]byte(id))
		if data == nil {
			return nil
		}
		return json.Unmarshal(data, &r)
	})
	return r, err
}

func (s *Store) ListRecords(limit int, offset int) ([]*SecurityRecord, error) {
	var records []*SecurityRecord
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketRecords))
		c := b.Cursor()
		count := 0
		skipped := 0
		for k, v := c.Last(); k != nil; k, v = c.Prev() {
			if skipped < offset {
				skipped++
				continue
			}
			if limit > 0 && count >= limit {
				break
			}
			var r SecurityRecord
			if err := json.Unmarshal(v, &r); err != nil {
				continue
			}
			records = append(records, &r)
			count++
		}
		return nil
	})
	return records, err
}

func (s *Store) SaveCrawlState(state *CrawlState) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketCrawlState))
		data, err := json.Marshal(state)
		if err != nil {
			return err
		}
		return b.Put([]byte(state.SiteCode), data)
	})
}

func (s *Store) GetCrawlState(siteCode string) (*CrawlState, error) {
	var state *CrawlState
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketCrawlState))
		data := b.Get([]byte(siteCode))
		if data == nil {
			state = &CrawlState{SiteCode: siteCode, LastPage: 1}
			return nil
		}
		return json.Unmarshal(data, &state)
	})
	return state, err
}

func (s *Store) SaveAlert(alert *AlertRecord) error {
	alert.ID = fmt.Sprintf("%s-%d", alert.RecordID, alert.SentAt.Unix())
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketAlerts))
		data, err := json.Marshal(alert)
		if err != nil {
			return err
		}
		return b.Put([]byte(alert.ID), data)
	})
}

func (s *Store) ListAlerts(limit int) ([]*AlertRecord, error) {
	var alerts []*AlertRecord
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketAlerts))
		c := b.Cursor()
		count := 0
		for k, v := c.Last(); k != nil; k, v = c.Prev() {
			if limit > 0 && count >= limit {
				break
			}
			var a AlertRecord
			if err := json.Unmarshal(v, &a); err != nil {
				continue
			}
			alerts = append(alerts, &a)
			count++
		}
		return nil
	})
	return alerts, err
}

func (s *Store) GetAlertCountForLevel(level string, since time.Time) (int, error) {
	count := 0
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketAlerts))
		c := b.Cursor()
		for k, v := c.Last(); k != nil; k, v = c.Prev() {
			var a AlertRecord
			if err := json.Unmarshal(v, &a); err != nil {
				continue
			}
			if a.AlertLevel == level && a.SentAt.After(since) {
				count++
			}
			if a.SentAt.Before(since) {
				break
			}
		}
		return nil
	})
	return count, err
}

func (s *Store) GetStats() (map[string]*SiteStats, error) {
	stats := make(map[string]*SiteStats)
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketStats))
		return b.ForEach(func(k, v []byte) error {
			var st SiteStats
			if err := json.Unmarshal(v, &st); err != nil {
				return err
			}
			stats[string(k)] = &st
			return nil
		})
	})
	return stats, err
}

func (s *Store) UpdateStats(siteCode string, duration time.Duration, newRecords int64) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketStats))
		var st SiteStats
		data := b.Get([]byte(siteCode))
		if data != nil {
			json.Unmarshal(data, &st)
		}
		st.SiteCode = siteCode
		st.TodayCount += newRecords
		st.WeekCount += newRecords
		st.TotalCount += newRecords
		st.LastCrawl = time.Now()
		if st.AvgDuration == 0 {
			st.AvgDuration = duration
		} else {
			st.AvgDuration = (st.AvgDuration + duration) / 2
		}
		newData, err := json.Marshal(st)
		if err != nil {
			return err
		}
		return b.Put([]byte(siteCode), newData)
	})
}

func (s *Store) CheckDuplicate(r *SecurityRecord) (bool, bool, error) {
	existing, err := s.GetRecord(r.ID)
	if err != nil {
		return false, false, err
	}
	if existing == nil {
		return false, false, nil
	}
	newHash := ComputeContentHash(r)
	isModified := existing.ContentHash != newHash
	return true, isModified, nil
}

func (s *Store) GetTotalRecords() (int64, error) {
	var count int64
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketRecords))
		count = int64(b.Stats().KeyN)
		return nil
	})
	return count, err
}

func ensureDir(path string) error {
	return os.MkdirAll(path, 0755)
}
