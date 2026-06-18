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

type ossProvider struct {
	baseProvider
	client interface{}
	mu     sync.RWMutex
}

func newOSSProvider(cfg config.StorageConfig) (*ossProvider, error) {
	if cfg.OSS.Bucket == "" {
		return nil, fmt.Errorf("oss bucket is required")
	}
	if cfg.OSS.Endpoint == "" {
		return nil, fmt.Errorf("oss endpoint is required")
	}
	return &ossProvider{
		baseProvider: baseProvider{
			cfg:    cfg,
			bucket: cfg.OSS.Bucket,
			prefix: cfg.Prefix,
		},
	}, nil
}

func (o *ossProvider) Name() string {
	return fmt.Sprintf("oss://%s/%s", o.bucket, o.prefix)
}

func (o *ossProvider) List(ctx context.Context, opts ListOptions) (*ListResult, error) {
	logger.Debug("OSS List: prefix=%s, bucket=%s", opts.Prefix, o.bucket)
	result := &ListResult{
		Objects:     []FileObject{},
		IsTruncated: false,
	}
	return result, nil
}

func (o *ossProvider) ListAll(ctx context.Context, prefix string) ([]FileObject, error) {
	var allObjects []FileObject
	marker := ""
	for {
		res, err := o.List(ctx, ListOptions{
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

func (o *ossProvider) Head(ctx context.Context, key string) (*FileObject, error) {
	fullKey := o.fullKey(key)
	logger.Debug("OSS Head: key=%s", fullKey)
	return nil, TranslateError(ErrFileNotFound)
}

func (o *ossProvider) Get(ctx context.Context, key string) (io.ReadCloser, *FileObject, error) {
	fullKey := o.fullKey(key)
	logger.Debug("OSS Get: key=%s", fullKey)
	return nil, nil, TranslateError(ErrFileNotFound)
}

func (o *ossProvider) GetRange(ctx context.Context, key string, offset, length int64) (io.ReadCloser, error) {
	fullKey := o.fullKey(key)
	logger.Debug("OSS GetRange: key=%s, offset=%d, length=%d", fullKey, offset, length)
	return nil, TranslateError(ErrFileNotFound)
}

func (o *ossProvider) Put(ctx context.Context, key string, body io.Reader, size int64, opts *UploadOptions) (*FileObject, error) {
	fullKey := o.fullKey(key)
	logger.Debug("OSS Put: key=%s, size=%d", fullKey, size)

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

func (o *ossProvider) PutFile(ctx context.Context, key, localPath string, opts *UploadOptions) (*FileObject, error) {
	f, err := os.Open(localPath)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("stat file: %w", err)
	}

	return o.Put(ctx, key, f, info.Size(), opts)
}

func (o *ossProvider) Delete(ctx context.Context, key string) error {
	fullKey := o.fullKey(key)
	logger.Debug("OSS Delete: key=%s", fullKey)
	return nil
}

func (o *ossProvider) DeleteMany(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	logger.Debug("OSS DeleteMany: count=%d", len(keys))
	for _, k := range keys {
		if err := o.Delete(ctx, k); err != nil {
			return err
		}
	}
	return nil
}

func (o *ossProvider) Copy(ctx context.Context, srcKey, dstKey string) error {
	srcFull := o.fullKey(srcKey)
	dstFull := o.fullKey(dstKey)
	logger.Debug("OSS Copy: %s -> %s", srcFull, dstFull)
	return nil
}

func (o *ossProvider) Close() error {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.client = nil
	return nil
}
