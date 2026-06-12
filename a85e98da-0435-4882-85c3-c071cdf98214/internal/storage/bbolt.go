package storage

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/klauspost/compress/zstd"
	"go.etcd.io/bbolt"
	"courttrack/internal/types"
)

const (
	BucketSites         = "sites"
	BucketNotices       = "notices"
	BucketIdxParty      = "idx_party"
	BucketIdxLawyer     = "idx_lawyer"
	BucketSubscriptions = "subscriptions"
	BucketCursors       = "cursors"
	BucketCaseNoIndex   = "idx_caseno"
)

type Store struct {
	db        *bbolt.DB
	zstdLevel int
	encoder   *zstd.Encoder
	decoder   *zstd.Decoder
}

func NewStore(dbPath string, zstdLevel int) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return nil, err
	}

	db, err := bbolt.Open(dbPath, 0600, &bbolt.Options{Timeout: 5 * time.Second})
	if err != nil {
		return nil, err
	}

	encoder, err := zstd.NewWriter(nil, zstd.WithEncoderLevel(zstd.EncoderLevel(zstdLevel)))
	if err != nil {
		_ = db.Close()
		return nil, err
	}

	decoder, err := zstd.NewReader(nil)
	if err != nil {
		_ = db.Close()
		return nil, err
	}

	s := &Store{
		db:        db,
		zstdLevel: zstdLevel,
		encoder:   encoder,
		decoder:   decoder,
	}

	if err := s.initBuckets(); err != nil {
		_ = db.Close()
		return nil, err
	}

	return s, nil
}

func (s *Store) initBuckets() error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		buckets := []string{
			BucketSites, BucketNotices, BucketIdxParty,
			BucketIdxLawyer, BucketSubscriptions, BucketCursors, BucketCaseNoIndex,
		}
		for _, b := range buckets {
			if _, err := tx.CreateBucketIfNotExists([]byte(b)); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) Close() error {
	if s.encoder != nil {
		s.encoder.Close()
	}
	if s.decoder != nil {
		s.decoder.Close()
	}
	return s.db.Close()
}

func (s *Store) compress(data []byte) []byte {
	return s.encoder.EncodeAll(data, nil)
}

func (s *Store) decompress(data []byte) ([]byte, error) {
	return s.decoder.DecodeAll(data, nil)
}

func (s *Store) SaveNotice(n *types.Notice) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		noticesB := tx.Bucket([]byte(BucketNotices))
		idxCaseNoB := tx.Bucket([]byte(BucketCaseNoIndex))

		data, err := json.Marshal(n)
		if err != nil {
			return err
		}

		compressed := s.compress(data)

		existing := noticesB.Get([]byte(n.ID))
		if existing != nil {
			existingData, err := s.decompress(existing)
			if err == nil {
				var existing types.Notice
				if json.Unmarshal(existingData, &existing) == nil {
					n.FirstSeen = existing.FirstSeen
					n.LastUpdated = time.Now()
					data, _ = json.Marshal(n)
					compressed = s.compress(data)
				}
			}
		} else {
			n.FirstSeen = time.Now()
			n.LastUpdated = n.FirstSeen
			data, _ = json.Marshal(n)
			compressed = s.compress(data)
		}

		if err := noticesB.Put([]byte(n.ID), compressed); err != nil {
			return err
		}

		if n.CaseNo != "" {
			caseKey := []byte(n.CaseNo)
			existingIDs := idxCaseNoB.Get(caseKey)
			var ids []string
			if existingIDs != nil {
				_ = json.Unmarshal(existingIDs, &ids)
			}
			if !contains(ids, n.ID) {
				ids = append(ids, n.ID)
				idsData, _ := json.Marshal(ids)
				if err := idxCaseNoB.Put(caseKey, idsData); err != nil {
					return err
				}
			}
		}

		return nil
	})
}

func (s *Store) GetNotice(id string) (*types.Notice, error) {
	var n *types.Notice
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketNotices))
		v := b.Get([]byte(id))
		if v == nil {
			return errors.New("notice not found")
		}
		data, err := s.decompress(v)
		if err != nil {
			return err
		}
		return json.Unmarshal(data, &n)
	})
	return n, err
}

func (s *Store) GetNoticeByCaseNo(caseNo string) ([]*types.Notice, error) {
	var notices []*types.Notice
	err := s.db.View(func(tx *bbolt.Tx) error {
		idxB := tx.Bucket([]byte(BucketCaseNoIndex))
		noticesB := tx.Bucket([]byte(BucketNotices))

		v := idxB.Get([]byte(caseNo))
		if v == nil {
			return nil
		}

		var ids []string
		if err := json.Unmarshal(v, &ids); err != nil {
			return err
		}

		for _, id := range ids {
			compressed := noticesB.Get([]byte(id))
			if compressed == nil {
				continue
			}
			data, err := s.decompress(compressed)
			if err != nil {
				continue
			}
			var n types.Notice
			if json.Unmarshal(data, &n) == nil {
				notices = append(notices, &n)
			}
		}
		return nil
	})
	return notices, err
}

func (s *Store) ScanNotices(limit int, offset int) ([]*types.Notice, error) {
	var notices []*types.Notice
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketNotices))
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
			data, err := s.decompress(v)
			if err != nil {
				continue
			}
			var n types.Notice
			if json.Unmarshal(data, &n) == nil {
				notices = append(notices, &n)
				count++
			}
		}
		return nil
	})
	return notices, err
}

func (s *Store) SaveCourtSiteMetadata(courtID string, data []byte) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketSites))
		return b.Put([]byte(courtID), data)
	})
}

func (s *Store) GetCourtSiteMetadata(courtID string) ([]byte, error) {
	var data []byte
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketSites))
		v := b.Get([]byte(courtID))
		if v == nil {
			return errors.New("not found")
		}
		data = make([]byte, len(v))
		copy(data, v)
		return nil
	})
	return data, err
}

func (s *Store) SaveCursor(c *types.Cursor) error {
	data, err := json.Marshal(c)
	if err != nil {
		return err
	}
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketCursors))
		return b.Put([]byte(c.CourtID), data)
	})
}

func (s *Store) GetCursor(courtID string) (*types.Cursor, error) {
	var c *types.Cursor
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketCursors))
		v := b.Get([]byte(courtID))
		if v == nil {
			return errors.New("cursor not found")
		}
		return json.Unmarshal(v, &c)
	})
	return c, err
}

func (s *Store) SaveSubscription(sub *types.Subscription) error {
	data, err := json.Marshal(sub)
	if err != nil {
		return err
	}
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketSubscriptions))
		return b.Put([]byte(sub.ID), data)
	})
}

func (s *Store) GetSubscriptions() ([]*types.Subscription, error) {
	var subs []*types.Subscription
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketSubscriptions))
		return b.ForEach(func(k, v []byte) error {
			var sub types.Subscription
			if json.Unmarshal(v, &sub) == nil {
				subs = append(subs, &sub)
			}
			return nil
		})
	})
	return subs, err
}

func (s *Store) DeleteSubscription(id string) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketSubscriptions))
		return b.Delete([]byte(id))
	})
}

func (s *Store) AddToIndex(bucketName string, key string, noticeID string) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(bucketName))
		existing := b.Get([]byte(key))
		var ids []string
		if existing != nil {
			_ = json.Unmarshal(existing, &ids)
		}
		if !contains(ids, noticeID) {
			ids = append(ids, noticeID)
			data, _ := json.Marshal(ids)
			return b.Put([]byte(key), data)
		}
		return nil
	})
}

func (s *Store) SearchIndex(bucketName string, prefix string) (map[string][]string, error) {
	results := make(map[string][]string)
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(bucketName))
		c := b.Cursor()
		prefixBytes := []byte(prefix)

		for k, v := c.Seek(prefixBytes); k != nil && bytes.HasPrefix(k, prefixBytes); k, v = c.Next() {
			var ids []string
			if json.Unmarshal(v, &ids) == nil {
				results[string(k)] = ids
			}
		}
		return nil
	})
	return results, err
}

func (s *Store) GetIndexEntries(bucketName string, key string) ([]string, error) {
	var ids []string
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(bucketName))
		v := b.Get([]byte(key))
		if v == nil {
			return errors.New("not found")
		}
		return json.Unmarshal(v, &ids)
	})
	return ids, err
}

func (s *Store) MarkSilenced(noticeID string, silenced bool) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketNotices))
		v := b.Get([]byte(noticeID))
		if v == nil {
			return errors.New("notice not found")
		}
		data, err := s.decompress(v)
		if err != nil {
			return err
		}
		var n types.Notice
		if err := json.Unmarshal(data, &n); err != nil {
			return err
		}
		n.Silenced = silenced
		n.LastUpdated = time.Now()
		newData, _ := json.Marshal(n)
		return b.Put([]byte(noticeID), s.compress(newData))
	})
}

func (s *Store) GetNoticesByTimeRange(start, end time.Time) ([]*types.Notice, error) {
	var notices []*types.Notice
	startBytes := timeToBytes(start)
	endBytes := timeToBytes(end)

	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(BucketNotices))
		return b.ForEach(func(k, v []byte) error {
			data, err := s.decompress(v)
			if err != nil {
				return nil
			}
			var n types.Notice
			if json.Unmarshal(data, &n) == nil {
				noticeTime := timeToBytes(n.PublishTime)
				if bytes.Compare(noticeTime, startBytes) >= 0 && bytes.Compare(noticeTime, endBytes) <= 0 {
					notices = append(notices, &n)
				}
			}
			return nil
		})
	})
	return notices, err
}

func (s *Store) Stats() (map[string]int64, error) {
	stats := make(map[string]int64)
	err := s.db.View(func(tx *bbolt.Tx) error {
		buckets := []string{BucketNotices, BucketSubscriptions, BucketIdxParty, BucketIdxLawyer, BucketCaseNoIndex}
		for _, name := range buckets {
			b := tx.Bucket([]byte(name))
			if b != nil {
				stats[name] = b.Stats().KeyN
			}
		}
		return nil
	})
	return stats, err
}

func timeToBytes(t time.Time) []byte {
	b := make([]byte, 8)
	binary.BigEndian.PutUint64(b, uint64(t.UnixNano()))
	return b
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func (s *Store) DBSize() (int64, error) {
	var size int64
	err := s.db.View(func(tx *bbolt.Tx) error {
		size = tx.Size()
		return nil
	})
	return size, nil
}

func (s *Store) HealthCheck() error {
	return s.db.View(func(tx *bbolt.Tx) error {
		stats := tx.Stats()
		if stats.OpenTxN > 10 {
			return fmt.Errorf("too many open transactions: %d", stats.OpenTxN)
		}
		return nil
	})
}
