package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"

	"cloudsync/internal/config"
	"cloudsync/internal/logger"
)

type s3Provider struct {
	baseProvider
	client interface{}
	mu     sync.RWMutex
}

func newS3Provider(cfg config.StorageConfig) (*s3Provider, error) {
	if cfg.S3.Bucket == "" {
		return nil, fmt.Errorf("s3 bucket is required")
	}
	return &s3Provider{
		baseProvider: baseProvider{
			cfg:    cfg,
			bucket: cfg.S3.Bucket,
			prefix: cfg.Prefix,
		},
	}, nil
}

func (s *s3Provider) Name() string {
	return fmt.Sprintf("s3://%s/%s", s.bucket, s.prefix)
}

func (s *s3Provider) List(ctx context.Context, opts ListOptions) (*ListResult, error) {
	logger.Debug("S3 List: prefix=%s, bucket=%s", opts.Prefix, s.bucket)
	result := &ListResult{
		Objects:     []FileObject{},
		IsTruncated: false,
	}
	return result, nil
}

func (s *s3Provider) ListAll(ctx context.Context, prefix string) ([]FileObject, error) {
	var allObjects []FileObject
	marker := ""
	for {
		res, err := s.List(ctx, ListOptions{
			Prefix:     prefix,
			MaxKeys:    1000,
			StartAfter: marker,
		})
		if err != nil {
			return nil, TranslateError(err)
		}
		allObjects = append(allObjects, res.Objects...)
		if !res.IsTruncated {
			break
		}
		marker = res.NextMarker
	}
	return allObjects, nil
}

func (s *s3Provider) Head(ctx context.Context, key string) (*FileObject, error) {
	fullKey := s.fullKey(key)
	logger.Debug("S3 Head: key=%s", fullKey)
	return nil, TranslateError(ErrFileNotFound)
}

func (s *s3Provider) Get(ctx context.Context, key string) (io.ReadCloser, *FileObject, error) {
	fullKey := s.fullKey(key)
	logger.Debug("S3 Get: key=%s", fullKey)
	return nil, nil, TranslateError(ErrFileNotFound)
}

func (s *s3Provider) GetRange(ctx context.Context, key string, offset, length int64) (io.ReadCloser, error) {
	fullKey := s.fullKey(key)
	logger.Debug("S3 GetRange: key=%s, offset=%d, length=%d", fullKey, offset, length)
	return nil, TranslateError(ErrFileNotFound)
}

func (s *s3Provider) Put(ctx context.Context, key string, body io.Reader, size int64, opts *UploadOptions) (*FileObject, error) {
	fullKey := s.fullKey(key)
	logger.Debug("S3 Put: key=%s, size=%d", fullKey, size)

	data, err := io.ReadAll(body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	if size > 0 && int64(len(data)) != size {
		return nil, fmt.Errorf("size mismatch: expected %d, got %d", size, len(data))
	}

	now := time.Now()
	return &FileObject{
		Key:          key,
		Size:         int64(len(data)),
		LastModified: now,
		ETag:         fmt.Sprintf(`"%x"`, len(data)),
		ContentType:  getContentType(opts, key),
		Metadata:     getMetadata(opts),
	}, nil
}

func (s *s3Provider) PutFile(ctx context.Context, key, localPath string, opts *UploadOptions) (*FileObject, error) {
	f, err := os.Open(localPath)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("stat file: %w", err)
	}

	return s.Put(ctx, key, f, info.Size(), opts)
}

func (s *s3Provider) Delete(ctx context.Context, key string) error {
	fullKey := s.fullKey(key)
	logger.Debug("S3 Delete: key=%s", fullKey)
	return nil
}

func (s *s3Provider) DeleteMany(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	logger.Debug("S3 DeleteMany: count=%d", len(keys))
	for _, k := range keys {
		if err := s.Delete(ctx, k); err != nil {
			return err
		}
	}
	return nil
}

func (s *s3Provider) Copy(ctx context.Context, srcKey, dstKey string) error {
	srcFull := s.fullKey(srcKey)
	dstFull := s.fullKey(dstKey)
	logger.Debug("S3 Copy: %s -> %s", srcFull, dstFull)
	return nil
}

func (s *s3Provider) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.client = nil
	return nil
}

type s3MockStore struct {
	mu      sync.RWMutex
	objects map[string][]byte
	metas   map[string]FileObject
}

var (
	s3MockInstance *s3MockStore
	s3MockOnce     sync.Once
)

func getS3Mock() *s3MockStore {
	s3MockOnce.Do(func() {
		s3MockInstance = &s3MockStore{
			objects: make(map[string][]byte),
			metas:   make(map[string]FileObject),
		}
	})
	return s3MockInstance
}

func getContentType(opts *UploadOptions, key string) string {
	if opts != nil && opts.ContentType != "" {
		return opts.ContentType
	}
	switch {
	case strings.HasSuffix(key, ".jpg"), strings.HasSuffix(key, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(key, ".png"):
		return "image/png"
	case strings.HasSuffix(key, ".gif"):
		return "image/gif"
	case strings.HasSuffix(key, ".pdf"):
		return "application/pdf"
	case strings.HasSuffix(key, ".json"):
		return "application/json"
	case strings.HasSuffix(key, ".html"), strings.HasSuffix(key, ".htm"):
		return "text/html"
	case strings.HasSuffix(key, ".txt"):
		return "text/plain"
	default:
		return "application/octet-stream"
	}
}

func getMetadata(opts *UploadOptions) map[string]string {
	if opts != nil && opts.Metadata != nil {
		return opts.Metadata
	}
	return map[string]string{}
}

type mockReadCloser struct {
	*bytes.Reader
}

func (m *mockReadCloser) Close() error { return nil }

func newMockReadCloser(data []byte) io.ReadCloser {
	return &mockReadCloser{Reader: bytes.NewReader(data)}
}
