package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"path"
	"strings"
	"time"

	"cloudsync/internal/config"
)

var (
	ErrFileNotFound    = errors.New("file not found")
	ErrPermissionDenied = errors.New("permission denied")
	ErrTimeout         = errors.New("operation timeout")
	ErrNetwork         = errors.New("network error")
)

type FileObject struct {
	Key          string            `json:"key"`
	Size         int64             `json:"size"`
	LastModified time.Time         `json:"last_modified"`
	ETag         string            `json:"etag"`
	Checksum     string            `json:"checksum"`
	ContentType  string            `json:"content_type"`
	Metadata     map[string]string `json:"metadata"`
	StorageClass string            `json:"storage_class"`
}

type UploadOptions struct {
	ContentType  string
	Metadata     map[string]string
	StorageClass string
	PartSize     int64
	Concurrency  int
}

type ListOptions struct {
	Prefix    string
	Delimiter string
	MaxKeys   int
	StartAfter string
}

type ListResult struct {
	Objects        []FileObject
	CommonPrefixes []string
	NextMarker     string
	IsTruncated    bool
}

type StorageProvider interface {
	Type() config.StorageType
	Name() string
	Bucket() string
	Prefix() string

	List(ctx context.Context, opts ListOptions) (*ListResult, error)
	ListAll(ctx context.Context, prefix string) ([]FileObject, error)

	Head(ctx context.Context, key string) (*FileObject, error)
	Get(ctx context.Context, key string) (io.ReadCloser, *FileObject, error)
	GetRange(ctx context.Context, key string, offset, length int64) (io.ReadCloser, error)

	Put(ctx context.Context, key string, body io.Reader, size int64, opts *UploadOptions) (*FileObject, error)
	PutFile(ctx context.Context, key, localPath string, opts *UploadOptions) (*FileObject, error)

	Delete(ctx context.Context, key string) error
	DeleteMany(ctx context.Context, keys []string) error

	Copy(ctx context.Context, srcKey, dstKey string) error

	Close() error
}

type baseProvider struct {
	cfg    config.StorageConfig
	bucket string
	prefix string
}

func (b *baseProvider) Type() config.StorageType { return b.cfg.Type }
func (b *baseProvider) Bucket() string           { return b.bucket }
func (b *baseProvider) Prefix() string           { return b.prefix }

func (b *baseProvider) fullKey(key string) string {
	if b.prefix == "" {
		return key
	}
	return path.Join(b.prefix, key)
}

func (b *baseProvider) stripPrefix(key string) string {
	if b.prefix == "" {
		return key
	}
	p := b.prefix
	if !strings.HasSuffix(p, "/") {
		p += "/"
	}
	return strings.TrimPrefix(key, p)
}

func NewProvider(cfg config.StorageConfig) (StorageProvider, error) {
	switch cfg.Type {
	case config.StorageTypeS3:
		return newS3Provider(cfg)
	case config.StorageTypeOSS:
		return newOSSProvider(cfg)
	case config.StorageTypeGCS:
		return newGCSProvider(cfg)
	default:
		return nil, fmt.Errorf("unsupported storage type: %s", cfg.Type)
	}
}

func IsRetryableError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, ErrNetwork) || errors.Is(err, ErrTimeout) {
		return true
	}
	errStr := strings.ToLower(err.Error())
	retryablePatterns := []string{
		"timeout",
		"connection reset",
		"connection refused",
		"network is unreachable",
		"no such host",
		"temporary failure",
		"try again",
		"too many requests",
		"rate limit",
		"service unavailable",
		"internal error",
		"bad gateway",
		"gateway timeout",
		"500",
		"502",
		"503",
		"504",
	}
	for _, p := range retryablePatterns {
		if strings.Contains(errStr, p) {
			return true
		}
	}
	return false
}

func TranslateError(err error) error {
	if err == nil {
		return nil
	}
	errStr := strings.ToLower(err.Error())
	switch {
	case strings.Contains(errStr, "not found"),
		strings.Contains(errStr, "no such key"),
		strings.Contains(errStr, "404"):
		return fmt.Errorf("%w: %v", ErrFileNotFound, err)
	case strings.Contains(errStr, "permission"),
		strings.Contains(errStr, "access denied"),
		strings.Contains(errStr, "unauthorized"),
		strings.Contains(errStr, "403"):
		return fmt.Errorf("%w: %v", ErrPermissionDenied, err)
	case strings.Contains(errStr, "timeout"),
		strings.Contains(errStr, "deadline exceeded"):
		return fmt.Errorf("%w: %v", ErrTimeout, err)
	default:
		return err
	}
}
