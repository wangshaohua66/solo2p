package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	"cloudsync/internal/config"
	"cloudsync/internal/logger"
)

type gcsProvider struct {
	baseProvider
	client interface{}
	mu     sync.RWMutex
}

func newGCSProvider(cfg config.StorageConfig) (*gcsProvider, error) {
	if cfg.GCS.Bucket == "" {
		return nil, fmt.Errorf("gcs bucket is required")
	}
	return &gcsProvider{
		baseProvider: baseProvider{
			cfg:    cfg,
			bucket: cfg.GCS.Bucket,
			prefix: cfg.Prefix,
		},
	}, nil
}

func (g *gcsProvider) Name() string {
	return fmt.Sprintf("gs://%s/%s", g.bucket, g.prefix)
}

func (g *gcsProvider) List(ctx context.Context, opts ListOptions) (*ListResult, error) {
	logger.Debug("GCS List: prefix=%s, bucket=%s", opts.Prefix, g.bucket)
	result := &ListResult{
		Objects:     []FileObject{},
		IsTruncated: false,
	}
	return result, nil
}

func (g *gcsProvider) ListAll(ctx context.Context, prefix string) ([]FileObject, error) {
	var allObjects []FileObject
	marker := ""
	for {
		res, err := g.List(ctx, ListOptions{
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

func (g *gcsProvider) Head(ctx context.Context, key string) (*FileObject, error) {
	fullKey := g.fullKey(key)
	logger.Debug("GCS Head: key=%s", fullKey)
	return nil, TranslateError(ErrFileNotFound)
}

func (g *gcsProvider) Get(ctx context.Context, key string) (io.ReadCloser, *FileObject, error) {
	fullKey := g.fullKey(key)
	logger.Debug("GCS Get: key=%s", fullKey)
	return nil, nil, TranslateError(ErrFileNotFound)
}

func (g *gcsProvider) GetRange(ctx context.Context, key string, offset, length int64) (io.ReadCloser, error) {
	fullKey := g.fullKey(key)
	logger.Debug("GCS GetRange: key=%s, offset=%d, length=%d", fullKey, offset, length)
	return nil, TranslateError(ErrFileNotFound)
}

func (g *gcsProvider) Put(ctx context.Context, key string, body io.Reader, size int64, opts *UploadOptions) (*FileObject, error) {
	fullKey := g.fullKey(key)
	logger.Debug("GCS Put: key=%s, size=%d", fullKey, size)

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

func (g *gcsProvider) PutFile(ctx context.Context, key, localPath string, opts *UploadOptions) (*FileObject, error) {
	f, err := os.Open(localPath)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("stat file: %w", err)
	}

	return g.Put(ctx, key, f, info.Size(), opts)
}

func (g *gcsProvider) Delete(ctx context.Context, key string) error {
	fullKey := g.fullKey(key)
	logger.Debug("GCS Delete: key=%s", fullKey)
	return nil
}

func (g *gcsProvider) DeleteMany(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	logger.Debug("GCS DeleteMany: count=%d", len(keys))
	for _, k := range keys {
		if err := g.Delete(ctx, k); err != nil {
			return err
		}
	}
	return nil
}

func (g *gcsProvider) Copy(ctx context.Context, srcKey, dstKey string) error {
	srcFull := g.fullKey(srcKey)
	dstFull := g.fullKey(dstKey)
	logger.Debug("GCS Copy: %s -> %s", srcFull, dstFull)
	return nil
}

func (g *gcsProvider) Close() error {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.client = nil
	return nil
}
