package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strconv"
	"sync"
	"time"

	"cloudsync/internal/config"
	"cloudsync/internal/logger"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

type ossProvider struct {
	baseProvider
	bucket *oss.Bucket
}

func newOSSProvider(cfg config.StorageConfig) (*ossProvider, error) {
	if cfg.OSS.Bucket == "" {
		return nil, fmt.Errorf("oss bucket is required")
	}
	if cfg.OSS.Endpoint == "" {
		return nil, fmt.Errorf("oss endpoint is required")
	}

	client, err := oss.New(cfg.OSS.Endpoint, cfg.OSS.AccessKeyID, cfg.OSS.AccessKeySecret)
	if err != nil {
		return nil, fmt.Errorf("create oss client: %w", err)
	}

	bucket, err := client.Bucket(cfg.OSS.Bucket)
	if err != nil {
		return nil, fmt.Errorf("get oss bucket: %w", err)
	}

	return &ossProvider{
		baseProvider: baseProvider{
			cfg:    cfg,
			bucket: cfg.OSS.Bucket,
			prefix: cfg.Prefix,
		},
		bucket: bucket,
	}, nil
}

func (o *ossProvider) Name() string {
	return fmt.Sprintf("oss://%s/%s", o.baseProvider.bucket, o.prefix)
}

func (o *ossProvider) List(ctx context.Context, opts ListOptions) (*ListResult, error) {
	prefix := opts.Prefix
	if prefix == "" {
		prefix = o.prefix
	}

	var ossOpts []oss.Option
	ossOpts = append(ossOpts, oss.MaxKeys(opts.MaxKeys))
	if prefix != "" {
		ossOpts = append(ossOpts, oss.Prefix(prefix))
	}
	if opts.StartAfter != "" {
		ossOpts = append(ossOpts, oss.Marker(opts.StartAfter))
	}
	if opts.Delimiter != "" {
		ossOpts = append(ossOpts, oss.Delimiter(opts.Delimiter))
	}

	res, err := o.bucket.ListObjects(ossOpts...)
	if err != nil {
		return nil, TranslateError(err)
	}

	result := &ListResult{
		Objects:        make([]FileObject, 0, len(res.Objects)),
		CommonPrefixes: res.CommonPrefixes,
		IsTruncated:    res.IsTruncated,
		NextMarker:    res.NextMarker,
	}

	for _, obj := range res.Objects {
		key := o.stripPrefix(obj.Key)
		etag := NormalizeETag(obj.ETag)
		result.Objects = append(result.Objects, FileObject{
			Key:          key,
			Size:         obj.Size,
			LastModified: obj.LastModified,
			ETag:         etag,
			Checksum:     ExtractMD5FromETag(etag),
			StorageClass: obj.Type,
		})
	}

	logger.Debug("OSS List: prefix=%s, count=%d, truncated=%v", prefix, len(result.Objects), result.IsTruncated)
	return result, nil
}

func (o *ossProvider) ListAll(ctx context.Context, prefix string) ([]FileObject, error) {
	if prefix == "" {
		prefix = o.prefix
	}

	var allObjects []FileObject
	marker := ""
	for {
		var ossOpts []oss.Option
		ossOpts = append(ossOpts, oss.MaxKeys(1000))
		if prefix != "" {
			ossOpts = append(ossOpts, oss.Prefix(prefix))
		}
		if marker != "" {
			ossOpts = append(ossOpts, oss.Marker(marker))
		}

		res, err := o.bucket.ListObjects(ossOpts...)
		if err != nil {
			return nil, TranslateError(err)
		}

		for _, obj := range res.Objects {
			key := o.stripPrefix(obj.Key)
			etag := NormalizeETag(obj.ETag)
			allObjects = append(allObjects, FileObject{
				Key:          key,
				Size:         obj.Size,
				LastModified: obj.LastModified,
				ETag:         etag,
				Checksum:     ExtractMD5FromETag(etag),
				StorageClass: obj.Type,
			})
		}

		if !res.IsTruncated {
			break
		}
		marker = res.NextMarker
	}

	return allObjects, nil
}

func (o *ossProvider) Head(ctx context.Context, key string) (*FileObject, error) {
	fullKey := o.fullKey(key)
	headers, err := o.bucket.GetObjectMeta(fullKey)
	if err != nil {
		return nil, TranslateError(err)
	}

	fo := &FileObject{Key: key}
	if v, ok := headers["Content-Length"]; ok && len(v) > 0 {
		if size, err := strconv.ParseInt(v[0], 10, 64); err == nil {
			fo.Size = size
		}
	}
	if v, ok := headers["Content-Type"]; ok && len(v) > 0 {
		fo.ContentType = v[0]
	}
	if v, ok := headers["Last-Modified"]; ok && len(v) > 0 {
		if t, err := time.Parse(time.RFC1123, v[0]); err == nil {
			fo.LastModified = t
		}
	}
	if v, ok := headers["ETag"]; ok && len(v) > 0 {
		etag := NormalizeETag(v[0])
		fo.ETag = etag
		fo.Checksum = ExtractMD5FromETag(etag)
	}
	return fo, nil
}

func (o *ossProvider) Get(ctx context.Context, key string) (io.ReadCloser, *FileObject, error) {
	fullKey := o.fullKey(key)
	body, err := o.bucket.GetObject(fullKey)
	if err != nil {
		return nil, nil, TranslateError(err)
	}

	headers, hErr := o.bucket.GetObjectMeta(fullKey)
	fo := &FileObject{Key: key}
	if hErr == nil {
		if v, ok := headers["Content-Length"]; ok && len(v) > 0 {
			if size, err := strconv.ParseInt(v[0], 10, 64); err == nil {
				fo.Size = size
			}
		}
		if v, ok := headers["ETag"]; ok && len(v) > 0 {
			etag := NormalizeETag(v[0])
			fo.ETag = etag
			fo.Checksum = ExtractMD5FromETag(etag)
		}
		if v, ok := headers["Content-Type"]; ok && len(v) > 0 {
			fo.ContentType = v[0]
		}
	}

	return body, fo, nil
}

func (o *ossProvider) GetRange(ctx context.Context, key string, offset, length int64) (io.ReadCloser, error) {
	fullKey := o.fullKey(key)
	body, err := o.bucket.GetObject(fullKey, oss.Range(offset, offset+length-1))
	if err != nil {
		return nil, TranslateError(err)
	}
	return body, nil
}

func (o *ossProvider) Put(ctx context.Context, key string, body io.Reader, size int64, opts *UploadOptions) (*FileObject, error) {
	fullKey := o.fullKey(key)
	logger.Debug("OSS Put: key=%s, size=%d", fullKey, size)

	contentType := getContentType(opts, key)
	metadata := getMetadata(opts)
	partSize := defaultPartSize
	uploadConcurrency := defaultUploadConcurrency
	if opts != nil {
		if opts.PartSize > 0 {
			partSize = opts.PartSize
		}
		if opts.Concurrency > 0 {
			uploadConcurrency = opts.Concurrency
		}
	}

	if size <= 0 || size <= multipartThreshold {
		return o.putSingle(ctx, key, fullKey, body, size, contentType, metadata)
	}

	partSize = calculatePartSize(size, partSize)
	return o.putMultipart(ctx, key, fullKey, body, size, partSize, uploadConcurrency, contentType, metadata)
}

func (o *ossProvider) putSingle(ctx context.Context, key, fullKey string, body io.Reader, size int64, contentType string, metadata map[string]string) (*FileObject, error) {
	var ossOpts []oss.Option
	ossOpts = append(ossOpts, oss.ContentType(contentType))
	for k, v := range metadata {
		ossOpts = append(ossOpts, oss.Meta(k, v))
	}

	err := o.bucket.PutObject(fullKey, body, ossOpts...)
	if err != nil {
		return nil, TranslateError(err)
	}

	fo := &FileObject{
		Key:          key,
		Size:         size,
		LastModified: time.Now(),
		ContentType:  contentType,
		Metadata:     metadata,
	}
	if headers, hErr := o.bucket.GetObjectMeta(fullKey); hErr == nil {
		if v, ok := headers["ETag"]; ok && len(v) > 0 {
			etag := NormalizeETag(v[0])
			fo.ETag = etag
			fo.Checksum = ExtractMD5FromETag(etag)
		}
	}
	return fo, nil
}

func (o *ossProvider) putMultipart(ctx context.Context, key, fullKey string, body io.Reader, size, partSize int64, concurrency int, contentType string, metadata map[string]string) (*FileObject, error) {
	logger.Debug("OSS multipart upload: key=%s, size=%d, partSize=%d, concurrency=%d", fullKey, size, partSize, concurrency)

	var ossOpts []oss.Option
	ossOpts = append(ossOpts, oss.ContentType(contentType))
	for k, v := range metadata {
		ossOpts = append(ossOpts, oss.Meta(k, v))
	}

	imur, err := o.bucket.InitiateMultipartUpload(fullKey, ossOpts...)
	if err != nil {
		return nil, TranslateError(err)
	}

	type partResult struct {
		Number int
		Part   oss.UploadPart
		Err    error
	}

	totalParts := int((size + partSize - 1) / partSize)
	resultCh := make(chan partResult, totalParts)
	sem := make(chan struct{}, concurrency)

	partNumber := 0
	buf := make([]byte, partSize)
	type pendingPart struct {
		number int
		data   []byte
	}
	pendingCh := make(chan pendingPart, concurrency)

	go func() {
		defer close(pendingCh)
		for {
			n, readErr := io.ReadFull(body, buf)
			if n > 0 {
				partNumber++
				data := make([]byte, n)
				copy(data, buf[:n])
				select {
				case <-ctx.Done():
					return
				case pendingCh <- pendingPart{number: partNumber, data: data}:
				}
			}
			if readErr == io.EOF || readErr == io.ErrUnexpectedEOF {
				break
			}
			if readErr != nil {
				break
			}
		}
	}()

	var wg sync.WaitGroup
	for pp := range pendingCh {
		sem <- struct{}{}
		wg.Add(1)
		go func(pp pendingPart) {
			defer wg.Done()
			defer func() { <-sem }()

			reader := bytes.NewReader(pp.data)
			part, err := o.bucket.UploadPart(imur, reader, int64(len(pp.data)), pp.number)
			resultCh <- partResult{Number: pp.number, Part: part, Err: err}
		}(pp)
	}

	go func() {
		wg.Wait()
		close(resultCh)
	}()

	parts := make([]oss.UploadPart, 0, totalParts)
	for pr := range resultCh {
		if pr.Err != nil {
			abortErr := o.bucket.AbortMultipartUpload(imur)
			logger.Warn("Upload part %d failed: %v (abort: %v)", pr.Number, pr.Err, abortErr)
			return nil, TranslateError(pr.Err)
		}
		parts = append(parts, pr.Part)
	}

	if len(parts) == 0 {
		abortErr := o.bucket.AbortMultipartUpload(imur)
		return nil, fmt.Errorf("no parts uploaded (abort: %v)", abortErr)
	}

	_, err = o.bucket.CompleteMultipartUpload(imur, parts)
	if err != nil {
		abortErr := o.bucket.AbortMultipartUpload(imur)
		return nil, fmt.Errorf("complete multipart: %w (abort: %v)", err, abortErr)
	}

	fo := &FileObject{
		Key:          key,
		Size:         size,
		LastModified: time.Now(),
		ContentType:  contentType,
		Metadata:     metadata,
	}
	if headers, hErr := o.bucket.GetObjectMeta(fullKey); hErr == nil {
		if v, ok := headers["ETag"]; ok && len(v) > 0 {
			etag := NormalizeETag(v[0])
			fo.ETag = etag
			fo.Checksum = ExtractMD5FromETag(etag)
		}
	}
	return fo, nil
}

func (o *ossProvider) PutFile(ctx context.Context, key, localPath string, opts *UploadOptions) (*FileObject, error) {
	return putFileViaReader(o, ctx, key, localPath, opts)
}

func (o *ossProvider) Delete(ctx context.Context, key string) error {
	fullKey := o.fullKey(key)
	if err := o.bucket.DeleteObject(fullKey); err != nil {
		return TranslateError(err)
	}
	return nil
}

func (o *ossProvider) DeleteMany(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	logger.Debug("OSS DeleteMany: count=%d", len(keys))

	const batchSize = 1000
	for i := 0; i < len(keys); i += batchSize {
		end := i + batchSize
		if end > len(keys) {
			end = len(keys)
		}
		batch := keys[i:end]
		fullKeys := make([]string, 0, len(batch))
		for _, k := range batch {
			fullKeys = append(fullKeys, o.fullKey(k))
		}

		_, err := o.bucket.DeleteObjects(fullKeys)
		if err != nil {
			return TranslateError(err)
		}
	}
	return nil
}

func (o *ossProvider) Copy(ctx context.Context, srcKey, dstKey string) error {
	srcFull := o.fullKey(srcKey)
	dstFull := o.fullKey(dstKey)

	_, err := o.bucket.CopyObject(srcFull, dstFull)
	if err != nil {
		return TranslateError(err)
	}
	return nil
}

func (o *ossProvider) Close() error {
	return nil
}
