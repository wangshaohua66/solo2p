package backup

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"time"

	"go.etcd.io/bbolt"

	"secfg/internal/crypto"
	"secfg/internal/errors"
	"secfg/internal/validator"
)

const (
	MaxBackupVersions = 30
	bucketBackups     = "backups"
	bucketMetadata    = "metadata"
)

type BackupSnapshot struct {
	ID        string    `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Files     []FileBackup `json:"files"`
	Comment   string    `json:"comment"`
	Version   int       `json:"version"`
	Size      int64     `json:"size"`
}

type FileBackup struct {
	Path     string `json:"path"`
	Content  []byte `json:"content"`
	Format   string `json:"format"`
	Checksum string `json:"checksum"`
}

type BackupInfo struct {
	ID        string    `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Comment   string    `json:"comment"`
	Version   int       `json:"version"`
	FileCount int       `json:"file_count"`
	Size      int64     `json:"size"`
}

type Manager struct {
	db      *bbolt.DB
	vault   *crypto.Vault
	baseDir string
}

func NewManager(baseDir string, vault *crypto.Vault) (*Manager, *errors.SecfgError) {
	if err := os.MkdirAll(baseDir, 0700); err != nil {
		return nil, errors.New(errors.E009, err, false)
	}

	dbPath := filepath.Join(baseDir, "backups.db")
	db, err := bbolt.Open(dbPath, 0600, &bbolt.Options{Timeout: 5 * time.Second})
	if err != nil {
		return nil, errors.New(errors.E013, err, false)
	}

	err = db.Update(func(tx *bbolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists([]byte(bucketBackups))
		if err != nil {
			return err
		}
		_, err = tx.CreateBucketIfNotExists([]byte(bucketMetadata))
		return err
	})
	if err != nil {
		db.Close()
		return nil, errors.New(errors.E013, err, false)
	}

	m := &Manager{
		db:      db,
		vault:   vault,
		baseDir: baseDir,
	}

	if err := m.cleanupOldBackups(); err != nil {
		fmt.Printf("\033[33m警告: 清理旧备份失败: %v\033[0m\n", err)
	}

	return m, nil
}

func (m *Manager) Close() {
	if m.db != nil {
		m.db.Close()
	}
}

func (m *Manager) CreateSnapshot(ctx context.Context, files []string, comment string) (*BackupSnapshot, *errors.SecfgError) {
	if err := ctx.Err(); err != nil {
		return nil, errors.NewWithMessage(errors.E009, "备份操作被取消", err, false)
	}

	snapshot := &BackupSnapshot{
		ID:        generateBackupID(),
		Timestamp: time.Now(),
		Comment:   comment,
		Files:     make([]FileBackup, 0),
	}

	var totalSize int64

	for _, filePath := range files {
		if err := ctx.Err(); err != nil {
			return nil, errors.NewWithMessage(errors.E009, "备份操作被取消", err, false)
		}

		if err := validator.ValidateConfigPath(filePath); err != nil {
			return nil, err
		}

		content, err := os.ReadFile(filePath)
		if err != nil {
			return nil, errors.New(errors.E014, err, false)
		}

		format := validator.DetectFileFormat(filePath)
		checksum := fmt.Sprintf("%x", content)

		compressed, secErr := compressData(content, ctx)
		if secErr != nil {
			return nil, secErr
		}

		var encrypted []byte
		if m.vault != nil {
			encryptedStr, secErr := m.vault.Encrypt(ctx, string(compressed))
			if secErr != nil {
				return nil, secErr
			}
			encrypted = []byte(encryptedStr)
		} else {
			encrypted = compressed
		}

		snapshot.Files = append(snapshot.Files, FileBackup{
			Path:     filePath,
			Content:  encrypted,
			Format:   format,
			Checksum: checksum,
		})

		totalSize += int64(len(content))
	}

	snapshot.Size = totalSize

	nextVersion, err := m.getNextVersion(ctx)
	if err != nil {
		return nil, err
	}
	snapshot.Version = nextVersion

	if err := m.storeSnapshot(ctx, snapshot); err != nil {
		return nil, err
	}

	if err := m.cleanupOldBackups(ctx); err != nil {
		fmt.Printf("\033[33m警告: 清理旧备份失败: %v\033[0m\n", err)
	}

	return snapshot, nil
}

func (m *Manager) RestoreSnapshot(ctx context.Context, backupID string, targetDir string) (*BackupSnapshot, *errors.SecfgError) {
	if err := ctx.Err(); err != nil {
		return nil, errors.NewWithMessage(errors.E010, "还原操作被取消", err, false)
	}

	snapshot, err := m.loadSnapshot(ctx, backupID)
	if err != nil {
		return nil, err
	}

	if targetDir == "" {
		targetDir = "/"
	}

	for _, file := range snapshot.Files {
		if err := ctx.Err(); err != nil {
			return nil, errors.NewWithMessage(errors.E010, "还原操作被取消", err, false)
		}

		var decrypted []byte
		if m.vault != nil && m.vault.IsEncrypted(string(file.Content)) {
			decryptedStr, err := m.vault.Decrypt(ctx, string(file.Content))
			if err != nil {
				return nil, errors.NewWithMessage(errors.E010,
					fmt.Sprintf("解密备份文件失败: %s", file.Path), err, false)
			}
			decrypted = []byte(decryptedStr)
		} else {
			decrypted = file.Content
		}

		decompressed, err := decompressData(decrypted, ctx)
		if err != nil {
			return nil, errors.NewWithMessage(errors.E010,
				fmt.Sprintf("解压备份文件失败: %s", file.Path), err, false)
		}

		targetPath := file.Path
		if targetDir != "/" {
			relPath := filepath.Base(file.Path)
			targetPath = filepath.Join(targetDir, relPath)
		}

		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return nil, errors.New(errors.E010, err, false)
		}

		if err := os.WriteFile(targetPath, decompressed, 0644); err != nil {
			return nil, errors.New(errors.E010, err, false)
		}
	}

	return snapshot, nil
}

func (m *Manager) ListBackups(ctx context.Context) ([]BackupInfo, *errors.SecfgError) {
	if err := ctx.Err(); err != nil {
		return nil, errors.NewWithMessage(errors.E013, "备份列表查询被取消", err, false)
	}

	var backups []BackupInfo

	err := m.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(bucketBackups))
		if b == nil {
			return nil
		}

		return b.ForEach(func(k, v []byte) error {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}

			var snapshot BackupSnapshot
			if err := json.Unmarshal(v, &snapshot); err != nil {
				return err
			}

			backups = append(backups, BackupInfo{
				ID:        snapshot.ID,
				Timestamp: snapshot.Timestamp,
				Comment:   snapshot.Comment,
				Version:   snapshot.Version,
				FileCount: len(snapshot.Files),
				Size:      snapshot.Size,
			})

			return nil
		})
	})

	if err != nil {
		return nil, errors.New(errors.E013, err, false)
	}

	sort.Slice(backups, func(i, j int) bool {
		return backups[i].Timestamp.After(backups[j].Timestamp)
	})

	return backups, nil
}

func (m *Manager) GetSnapshot(ctx context.Context, backupID string) (*BackupSnapshot, *errors.SecfgError) {
	return m.loadSnapshot(ctx, backupID)
}

func (m *Manager) FindSnapshotByTime(ctx context.Context, targetTime time.Time) (*BackupSnapshot, *errors.SecfgError) {
	backups, err := m.ListBackups(ctx)
	if err != nil {
		return nil, err
	}

	if len(backups) == 0 {
		return nil, errors.NewWithMessage(errors.E001, "没有找到备份", nil, false)
	}

	var closest *BackupInfo
	var minDiff time.Duration

	for _, b := range backups {
		diff := targetTime.Sub(b.Timestamp)
		if diff < 0 {
			diff = -diff
		}
		if closest == nil || diff < minDiff {
			closest = &b
			minDiff = diff
		}
	}

	if closest == nil {
		return nil, errors.NewWithMessage(errors.E001, "没有找到匹配的备份", nil, false)
	}

	return m.loadSnapshot(ctx, closest.ID)
}

func (m *Manager) DeleteSnapshot(ctx context.Context, backupID string) *errors.SecfgError {
	if err := ctx.Err(); err != nil {
		return errors.NewWithMessage(errors.E013, "删除备份被取消", err, false)
	}

	err := m.db.Update(func(tx *bbolt.Tx) error {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		b := tx.Bucket([]byte(bucketBackups))
		if b == nil {
			return fmt.Errorf("backups bucket not found")
		}
		return b.Delete([]byte(backupID))
	})

	if err != nil {
		return errors.New(errors.E013, err, false)
	}

	return nil
}

func (m *Manager) storeSnapshot(ctx context.Context, snapshot *BackupSnapshot) *errors.SecfgError {
	if err := ctx.Err(); err != nil {
		return errors.NewWithMessage(errors.E013, "存储备份被取消", err, false)
	}

	data, err := json.Marshal(snapshot)
	if err != nil {
		return errors.New(errors.E009, err, false)
	}

	err = m.db.Update(func(tx *bbolt.Tx) error {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		b := tx.Bucket([]byte(bucketBackups))
		if b == nil {
			return fmt.Errorf("backups bucket not found")
		}
		return b.Put([]byte(snapshot.ID), data)
	})

	if err != nil {
		return errors.New(errors.E013, err, false)
	}

	return nil
}

func (m *Manager) loadSnapshot(ctx context.Context, backupID string) (*BackupSnapshot, *errors.SecfgError) {
	if err := ctx.Err(); err != nil {
		return nil, errors.NewWithMessage(errors.E013, "加载备份被取消", err, false)
	}

	var snapshot BackupSnapshot
	var found bool

	err := m.db.View(func(tx *bbolt.Tx) error {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		b := tx.Bucket([]byte(bucketBackups))
		if b == nil {
			return fmt.Errorf("backups bucket not found")
		}

		data := b.Get([]byte(backupID))
		if data == nil {
			return nil
		}

		found = true
		return json.Unmarshal(data, &snapshot)
	})

	if err != nil {
		return nil, errors.New(errors.E013, err, false)
	}

	if !found {
		return nil, errors.NewWithMessage(errors.E001,
			fmt.Sprintf("备份不存在: %s", backupID), nil, false)
	}

	return &snapshot, nil
}

func (m *Manager) getNextVersion(ctx context.Context) (int, *errors.SecfgError) {
	if err := ctx.Err(); err != nil {
		return 0, errors.NewWithMessage(errors.E013, "获取版本被取消", err, false)
	}

	maxVersion := 0

	err := m.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(bucketBackups))
		if b == nil {
			return nil
		}

		return b.ForEach(func(k, v []byte) error {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}

			var snapshot BackupSnapshot
			if err := json.Unmarshal(v, &snapshot); err != nil {
				return err
			}
			if snapshot.Version > maxVersion {
				maxVersion = snapshot.Version
			}
			return nil
		})
	})

	if err != nil {
		return 0, errors.New(errors.E013, err, false)
	}

	return maxVersion + 1, nil
}

func (m *Manager) cleanupOldBackups(ctx context.Context) *errors.SecfgError {
	backups, err := m.ListBackups(ctx)
	if err != nil {
		return err
	}

	if len(backups) <= MaxBackupVersions {
		return nil
	}

	for i := MaxBackupVersions; i < len(backups); i++ {
		if err := ctx.Err(); err != nil {
			return errors.NewWithMessage(errors.E013, "清理备份被取消", err, false)
		}
		if err := m.DeleteSnapshot(ctx, backups[i].ID); err != nil {
			return err
		}
	}

	return nil
}

func generateBackupID() string {
	return fmt.Sprintf("bkp_%d", time.Now().UnixNano())
}

func compressData(data []byte, ctx context.Context) ([]byte, *errors.SecfgError) {
	if err := ctx.Err(); err != nil {
		return nil, errors.NewWithMessage(errors.E009, "压缩被取消", err, false)
	}

	var buf bytes.Buffer
	gz, err := gzip.NewWriterLevel(&buf, gzip.BestCompression)
	if err != nil {
		return nil, errors.New(errors.E009, err, false)
	}

	if _, err := gz.Write(data); err != nil {
		gz.Close()
		return nil, errors.New(errors.E009, err, false)
	}

	if err := gz.Close(); err != nil {
		return nil, errors.New(errors.E009, err, false)
	}

	return buf.Bytes(), nil
}

func decompressData(data []byte, ctx context.Context) ([]byte, *errors.SecfgError) {
	if err := ctx.Err(); err != nil {
		return nil, errors.NewWithMessage(errors.E010, "解压被取消", err, false)
	}

	buf := bytes.NewBuffer(data)
	gz, err := gzip.NewReader(buf)
	if err != nil {
		return nil, errors.New(errors.E010, err, false)
	}
	defer gz.Close()

	result, err := io.ReadAll(gz)
	if err != nil {
		return nil, errors.New(errors.E010, err, false)
	}

	return result, nil
}
