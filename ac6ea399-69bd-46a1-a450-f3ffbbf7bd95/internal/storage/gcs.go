package storage

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"cloudsync/internal/config"
	"cloudsync/internal/logger"

	"cloud.google.com/go/storage"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

type gcsProvider struct {
	baseProvider
	client *storage.Client
}

func newGCSProvider(cfg config.StorageConfig) (*gcsProvider, error) {
	if cfg.GCS.Bucket == "" {
		return nil, fmt.Errorf("gcs bucket is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var opts []option.ClientOption
	if cfg.GCS.CredentialsFile != "" {
		opts = append(opts, option.WithCredentialsFile(cfg.GCS.CredentialsFile))
	}

	client, err := storage.NewClient(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("create gcs client: %w", err)
	}

	return &gcsProvider{
		baseProvider: baseProvider{
			cfg:    cfg,
			bucket: cfg.GCS.Bucket,
			prefix: cfg.Prefix,
		},
		client: client,
	}, nil
}

func (g *gcsProvider) Name() string {
	return fmt.Sprintf("gs://%s/%s", g.bucket, g.prefix)
}

func (g *gcsProvider) List(ctx context.Context, opts ListOptions) (*ListResult, error) {
	prefix := opts.Prefix
	if prefix == "" {
		prefix = g.prefix
	}

	query := &storage.Query{Prefix: prefix}
	if opts.Delimiter != "" {
		query.Delimiter = opts.Delimiter
	}

	bkt := g.client.Bucket(g.bucket)
	it := bkt.Objects(ctx, query)

	result := &ListResult{
		Objects:        make([]FileObject, 0),
		CommonPrefixes: make([]string, 0),
	}

	count := 0
	for {
		if opts.MaxKeys > 0 && count >= opts.MaxKeys {
			result.IsTruncated = true
			break
		}

		attrs, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, TranslateError(err)
		}

		if attrs.Prefix != "" {
			result.CommonPrefixes = append(result.CommonPrefixes, attrs.Prefix)
			continue
		}

		key := g.stripPrefix(attrs.Name)
		etag := NormalizeETag(attrs.Etag)
		result.Objects = append(result.Objects, FileObject{
			Key:          key,
			Size:         attrs.Size,
			LastModified: attrs.Updated,
			ETag:         etag,
			Checksum:     ExtractMD5FromETag(etag),
			ContentType:  attrs.ContentType,
			StorageClass: attrs.StorageClass,
		})
		count++

		if attrs.Name != "" {
			result.NextMarker = attrs.Name
		}
	}

	logger.Debug("GCS List: prefix=%s, count=%d, truncated=%v", prefix, len(result.Objects), result.IsTruncated)
	return result, nil
}

func (g *gcsProvider) ListAll(ctx context.Context, prefix string) ([]FileObject, error) {
	if prefix == "" {
		prefix = g.prefix
	}

	bkt := g.client.Bucket(g.bucket)
	query := &storage.Query{Prefix: prefix}
	it := bkt.Objects(ctx, query)

	var allObjects []FileObject
	for {
		attrs, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, TranslateError(err)
		}

		if attrs.Prefix != "" {
			continue
		}

		key := g.stripPrefix(attrs.Name)
		etag := NormalizeETag(attrs.Etag)
		allObjects = append(allObjects, FileObject{
			Key:          key,
			Size:         attrs.Size,
			LastModified: attrs.Updated,
			ETag:         etag,
			Checksum:     ExtractMD5FromETag(etag),
			ContentType:  attrs.ContentType,
			StorageClass: attrs.StorageClass,
		})
	}

	return allObjects, nil
}

func (g *gcsProvider) Head(ctx context.Context, key string) (*FileObject, error) {
	fullKey := g.fullKey(key)
	attrs, err := g.client.Bucket(g.bucket).Object(fullKey).Attrs(ctx)
	if err != nil {
		return nil, TranslateError(err)
	}
	etag := NormalizeETag(attrs.Etag)
	return &FileObject{
		Key:          key,
		Size:         attrs.Size,
		LastModified: attrs.Updated,
		ETag:         etag,
		Checksum:     ExtractMD5FromETag(etag),
		ContentType:  attrs.ContentType,
		StorageClass: attrs.StorageClass,
	}, nil
}

func (g *gcsProvider) Get(ctx context.Context, key string) (io.ReadCloser, *FileObject, error) {
	fullKey := g.fullKey(key)
	reader, err := g.client.Bucket(g.bucket).Object(fullKey).NewReader(ctx)
	if err != nil {
		return nil, nil, TranslateError(err)
	}

	fo := &FileObject{
		Key:          key,
		Size:         reader.Attrs.Size,
		ContentType:  reader.Attrs.ContentType,
		LastModified: reader.Attrs.LastModified,
	}

	return reader, fo, nil
}

func (g *gcsProvider) GetRange(ctx context.Context, key string, offset, length int64) (io.ReadCloser, error) {
	fullKey := g.fullKey(key)
	reader, err := g.client.Bucket(g.bucket).Object(fullKey).NewRangeReader(ctx, offset, length)
	if err != nil {
		return nil, TranslateError(err)
	}
	return reader, nil
}

func (g *gcsProvider) Put(ctx context.Context, key string, body io.Reader, size int64, opts *UploadOptions) (*FileObject, error) {
	fullKey := g.fullKey(key)
	logger.Debug("GCS Put: key=%s, size=%d", fullKey, size)

	contentType := getContentType(opts, key)
	metadata := getMetadata(opts)

	chunkSize := defaultPartSize
	if opts != nil {
		if opts.PartSize > 0 {
			chunkSize = opts.PartSize
		}
	}

	if size > 0 {
		chunkSize = calculatePartSize(size, chunkSize)
	}

	obj := g.client.Bucket(g.bucket).Object(fullKey)

	w := obj.NewWriter(ctx)
	w.ContentType = contentType
	w.ChunkSize = int(chunkSize)
	if len(metadata) > 0 {
		w.Metadata = metadata
	}
	if opts != nil && opts.StorageClass != "" {
		w.StorageClass = opts.StorageClass
	}

	pr := newProgressReader(body, size, func(read, total int64) {
		logger.Debug("GCS upload progress: %s = %d/%d bytes", fullKey, read, total)
	})

	buf := make([]byte, 256*1024)
	_, err := io.CopyBuffer(w, pr, buf)
	if err != nil {
		w.Close()
		return nil, TranslateError(err)
	}

	if err := w.Close(); err != nil {
		return nil, TranslateError(err)
	}

	attrs, err := obj.Attrs(ctx)
	fo := &FileObject{
		Key:          key,
		Size:         size,
		LastModified: time.Now(),
		ContentType:  contentType,
		Metadata:     metadata,
	}
	if err == nil && attrs != nil {
		fo.Size = attrs.Size
		etag := NormalizeETag(attrs.Etag)
		fo.ETag = etag
		fo.Checksum = ExtractMD5FromETag(etag)
		fo.LastModified = attrs.Updated
	}

	return fo, nil
}

func (g *gcsProvider) PutFile(ctx context.Context, key, localPath string, opts *UploadOptions) (*FileObject, error) {
	return putFileViaReader(g, ctx, key, localPath, opts)
}

func (g *gcsProvider) Delete(ctx context.Context, key string) error {
	fullKey := g.fullKey(key)
	err := g.client.Bucket(g.bucket).Object(fullKey).Delete(ctx)
	if err != nil {
		return TranslateError(err)
	}
	return nil
}

func (g *gcsProvider) DeleteMany(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	logger.Debug("GCS DeleteMany: count=%d", len(keys))

	for _, k := range keys {
		fullKey := g.fullKey(k)
		if err := g.client.Bucket(g.bucket).Object(fullKey).Delete(ctx); err != nil {
			errStr := strings.ToLower(err.Error())
			if !strings.Contains(errStr, "not found") && !strings.Contains(errStr, "404") {
				return TranslateError(err)
			}
		}
	}
	return nil
}

func (g *gcsProvider) Copy(ctx context.Context, srcKey, dstKey string) error {
	srcFull := g.fullKey(srcKey)
	dstFull := g.fullKey(dstKey)

	src := g.client.Bucket(g.bucket).Object(srcFull)
	dst := g.client.Bucket(g.bucket).Object(dstFull)

	_, err := dst.CopierFrom(src).Run(ctx)
	if err != nil {
		return TranslateError(err)
	}
	return nil
}

func (g *gcsProvider) Close() error {
	if g.client != nil {
		return g.client.Close()
	}
	return nil
}
