package store

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"bankrupt-monitor/internal/model"
	"bankrupt-monitor/internal/validator"

	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Store struct {
	db     *gorm.DB
	logger *zap.Logger
	mu     sync.RWMutex
}

type CaseQuery struct {
	Keyword          string
	Court            string
	Debtor           string
	CaseNumber       string
	AnnouncementType string
	FromDate         *time.Time
	ToDate           *time.Time
	IsRead           *bool
	HitSubscription  *bool
	Withdrawn        *bool
	Page             int
	PageSize         int
	SortBy           string
	SortOrder        string
}

func NewStore(dbPath string, log *zap.Logger) (*Store, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}

	dsn := fmt.Sprintf("%s?_journal=WAL&_busy_timeout=5000&_cache_size=-64000&_synchronous=NORMAL", dbPath)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	s := &Store{db: db, logger: log}

	if err := s.migrate(); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return s, nil
}

func (s *Store) migrate() error {
	return s.db.AutoMigrate(
		&model.Case{},
		&model.Announcement{},
		&model.Subscription{},
		&model.DeadLetter{},
	)
}

func (s *Store) DB() *gorm.DB {
	return s.db
}

func (s *Store) Close() error {
	sqlDB, err := s.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func (s *Store) UpsertCase(c *model.Case) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var existing model.Case
	err := s.db.Where("debtor_fingerprint = ?", c.DebtorFingerprint).
		Or("(court = ? AND case_number_norm = ?)", c.Court, c.CaseNumberNorm).
		First(&existing).Error

	if err == nil {
		c.ID = existing.ID
		c.CreatedAt = existing.CreatedAt
		if err := s.db.Save(c).Error; err != nil {
			return false, err
		}
		return false, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, err
	}

	if err := validator.ValidateCase(c); err != nil {
		s.logger.Warn("case validation skipped", zap.Error(err))
	}

	if err := s.db.Create(c).Error; err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) UpsertAnnouncement(a *model.Announcement) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var existing model.Announcement
	err := s.db.Where("fingerprint = ?", a.Fingerprint).First(&existing).Error

	if err == nil {
		a.ID = existing.ID
		a.FirstDiscovered = existing.FirstDiscovered
		if err := s.db.Save(a).Error; err != nil {
			return false, err
		}
		return false, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, err
	}

	if err := validator.ValidateAnnouncement(a); err != nil {
		s.logger.Warn("announcement validation skipped", zap.Error(err))
	}

	if err := s.db.Create(a).Error; err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) GetCaseByID(id uint64) (*model.Case, error) {
	var c model.Case
	err := s.db.Preload("Announcements").First(&c, id).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Store) GetAnnouncementByFingerprint(fp string) (*model.Announcement, error) {
	var a model.Announcement
	err := s.db.Where("fingerprint = ?", fp).First(&a).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *Store) QueryCases(q *CaseQuery) ([]model.Case, int64, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := s.db.Model(&model.Case{})

	if q.Keyword != "" {
		kw := "%" + strings.TrimSpace(q.Keyword) + "%"
		query = query.Where("(debtor LIKE ? OR case_number LIKE ? OR case_number_norm LIKE ? OR ruling_number LIKE ? OR creditors LIKE ?)",
			kw, kw, kw, kw, kw)
	}
	if q.Court != "" {
		query = query.Where("court LIKE ?", "%"+q.Court+"%")
	}
	if q.Debtor != "" {
		query = query.Where("debtor LIKE ?", "%"+q.Debtor+"%")
	}
	if q.CaseNumber != "" {
		query = query.Where("(case_number LIKE ? OR case_number_norm LIKE ?)", "%"+q.CaseNumber+"%", "%"+q.CaseNumber+"%")
	}
	if q.AnnouncementType != "" {
		query = query.Where("announcement_type = ?", q.AnnouncementType)
	}
	if q.FromDate != nil {
		query = query.Where("created_at >= ?", *q.FromDate)
	}
	if q.ToDate != nil {
		query = query.Where("created_at <= ?", *q.ToDate)
	}
	if q.IsRead != nil {
		query = query.Where("is_read = ?", *q.IsRead)
	}
	if q.HitSubscription != nil {
		query = query.Where("hit_subscription = ?", *q.HitSubscription)
	}
	if q.Withdrawn != nil {
		query = query.Where("is_withdrawn = ?", *q.Withdrawn)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	sortBy := "created_at"
	sortOrder := "DESC"
	if q.SortBy != "" {
		valid := map[string]bool{
			"created_at": true, "updated_at": true, "claim_deadline": true,
			"court": true, "debtor": true, "case_number": true,
		}
		if valid[q.SortBy] {
			sortBy = q.SortBy
		}
	}
	if strings.EqualFold(q.SortOrder, "asc") {
		sortOrder = "ASC"
	}

	page := q.Page
	if page < 1 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize < 1 || pageSize > 500 {
		pageSize = 20
	}

	var cases []model.Case
	err := query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder)).
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&cases).Error

	return cases, total, err
}

func (s *Store) MarkCaseRead(ids []uint64, read bool) error {
	return s.db.Model(&model.Case{}).Where("id IN ?", ids).Update("is_read", read).Error
}

func (s *Store) TagCases(ids []uint64, tags string) error {
	return s.db.Model(&model.Case{}).Where("id IN ?", ids).Update("tags", gorm.Expr("COALESCE(tags, '') || ?", ","+tags)).Error
}

func (s *Store) AddSubscription(sub *model.Subscription) error {
	if err := validator.ValidateSubscription(sub); err != nil {
		return err
	}
	return s.db.Create(sub).Error
}

func (s *Store) GetSubscriptions(enabledOnly bool) ([]model.Subscription, error) {
	var subs []model.Subscription
	q := s.db
	if enabledOnly {
		q = q.Where("enabled = ?", true)
	}
	err := q.Find(&subs).Error
	return subs, err
}

func (s *Store) DeleteSubscription(id uint64) error {
	return s.db.Delete(&model.Subscription{}, id).Error
}

func (s *Store) AddDeadLetter(dl *model.DeadLetter) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Create(dl).Error
}

func (s *Store) GetDeadLetters(limit int) ([]model.DeadLetter, error) {
	var dls []model.DeadLetter
	if limit < 1 {
		limit = 100
	}
	err := s.db.Order("created_at DESC").Limit(limit).Find(&dls).Error
	return dls, err
}

func (s *Store) DeleteDeadLetter(id uint64) error {
	return s.db.Delete(&model.DeadLetter{}, id).Error
}

func (s *Store) MarkAnnouncementsWithdrawn(court string, before time.Time, fps map[string]bool) (int64, error) {
	var count int64
	query := s.db.Model(&model.Announcement{}).
		Where("court = ? AND announcement_date < ? AND is_withdrawn = ?", court, before, false)

	var fpsToKeep []string
	for fp := range fps {
		fpsToKeep = append(fpsToKeep, fp)
	}
	if len(fpsToKeep) > 0 {
		query = query.Where("fingerprint NOT IN ?", fpsToKeep)
	}

	result := query.Update("is_withdrawn", true)
	count = result.RowsAffected
	return count, result.Error
}

func (s *Store) GetAnnouncementFingerprints(court string, from time.Time) (map[string]bool, error) {
	var fps []string
	err := s.db.Model(&model.Announcement{}).
		Where("court = ? AND first_discovered >= ?", court, from).
		Pluck("fingerprint", &fps).Error
	if err != nil {
		return nil, err
	}
	m := make(map[string]bool, len(fps))
	for _, fp := range fps {
		m[fp] = true
	}
	return m, nil
}
