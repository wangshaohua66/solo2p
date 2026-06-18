package storage

import (
	"context"
	"fmt"
	"io"
	"time"

	"cloudsync/internal/config"
	"cloudsync/internal/logger"

	"github.com/aws/aws-sdk-go-v2/aws"
	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type s3Provider struct {
	baseProvider
	client   *s3.Client
	uploader *manager.Uploader
}

func newS3Provider(cfg config.StorageConfig) (*s3Provider, error) {
	if cfg.S3.Bucket == "" {
		return nil, fmt.Errorf("s3 bucket is required")
	}
	if cfg.S3.Region == "" {
		return nil, fmt.Errorf("s3 region is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var loadOpts []func(*awscfg.LoadOptions) error
	loadOpts = append(loadOpts, awscfg.WithRegion(cfg.S3.Region))

	if cfg.S3.AccessKeyID != "" && cfg.S3.SecretAccessKey != "" {
		loadOpts = append(loadOpts, awscfg.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.S3.AccessKeyID, cfg.S3.SecretAccessKey, ""),
		))
	}

	awsCfg, err := awscfg.LoadDefaultConfig(ctx, loadOpts...)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	s3Opts := []func(*s3.Options){}
	if cfg.S3.Endpoint != "" {
		s3Opts = append(s3Opts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(cfg.S3.Endpoint)
			if cfg.S3.ForcePathStyle {
				o.UsePathStyle = true
			}
		})
	}
	if cfg.S3.ForcePathStyle && cfg.S3.Endpoint == "" {
		s3Opts = append(s3Opts, func(o *s3.Options) {
			o.UsePathStyle = true
		})
	}

	client := s3.NewFromConfig(awsCfg, s3Opts...)

	uploader := manager.NewUploader(client, func(u *manager.Uploader) {
		u.PartSize = defaultPartSize
		u.Concurrency = defaultUploadConcurrency
	})

	return &s3Provider{
		baseProvider: baseProvider{
			cfg:    cfg,
			bucket: cfg.S3.Bucket,
			prefix: cfg.Prefix,
		},
		client:   client,
		uploader: uploader,
	}, nil
}

func (s *s3Provider) Name() string {
	return fmt.Sprintf("s3://%s/%s", s.bucket, s.prefix)
}

func (s *s3Provider) List(ctx context.Context, opts ListOptions) (*ListResult, error) {
	prefix := opts.Prefix
	if prefix == "" {
		prefix = s.prefix
	}

	input := &s3.ListObjectsV2Input{
		Bucket: aws.String(s.bucket),
	}
	if prefix != "" {
		input.Prefix = aws.String(prefix)
	}
	if opts.MaxKeys > 0 {
		input.MaxKeys = aws.Int32(int32(opts.MaxKeys))
	}
	if opts.StartAfter != "" {
		input.StartAfter = aws.String(opts.StartAfter)
	}
	if opts.Delimiter != "" {
		input.Delimiter = aws.String(opts.Delimiter)
	}

	out, err := s.client.ListObjectsV2(ctx, input)
	if err != nil {
		return nil, TranslateError(err)
	}

	result := &ListResult{
		Objects:        make([]FileObject, 0, len(out.Contents)),
		CommonPrefixes: make([]string, 0, len(out.CommonPrefixes)),
		IsTruncated:    aws.ToBool(out.IsTruncated),
	}
	if out.NextContinuationToken != nil {
		result.NextMarker = *out.NextContinuationToken
	}

	for _, obj := range out.Contents {
		key := s.stripPrefix(*obj.Key)
		etag := NormalizeETag(*obj.ETag)
		result.Objects = append(result.Objects, FileObject{
			Key:          key,
			Size:         aws.ToInt64(obj.Size),
			LastModified: *obj.LastModified,
			ETag:         etag,
			Checksum:     ExtractMD5FromETag(etag),
			StorageClass: string(obj.StorageClass),
		})
	}
	for _, cp := range out.CommonPrefixes {
		if cp.Prefix != nil {
			result.CommonPrefixes = append(result.CommonPrefixes, *cp.Prefix)
		}
	}

	logger.Debug("S3 List: prefix=%s, count=%d, truncated=%v", prefix, len(result.Objects), result.IsTruncated)
	return result, nil
}

func (s *s3Provider) ListAll(ctx context.Context, prefix string) ([]FileObject, error) {
	if prefix == "" {
		prefix = s.prefix
	}
	var allObjects []FileObject
	var token *string

	for {
		input := &s3.ListObjectsV2Input{
			Bucket:            aws.String(s.bucket),
			ContinuationToken: token,
		}
		if prefix != "" {
			input.Prefix = aws.String(prefix)
		}
		input.MaxKeys = aws.Int32(1000)

		out, err := s.client.ListObjectsV2(ctx, input)
		if err != nil {
			return nil, TranslateError(err)
		}

		for _, obj := range out.Contents {
			if obj.Key == nil {
				continue
			}
			key := s.stripPrefix(*obj.Key)
			etag := NormalizeETag(*obj.ETag)
			fo := FileObject{
				Key:          key,
				Size:         aws.ToInt64(obj.Size),
				LastModified: *obj.LastModified,
				ETag:         etag,
				Checksum:     ExtractMD5FromETag(etag),
				StorageClass: string(obj.StorageClass),
			}
			allObjects = append(allObjects, fo)
		}

		if !aws.ToBool(out.IsTruncated) {
			break
		}
		token = out.NextContinuationToken
	}

	return allObjects, nil
}

func (s *s3Provider) Head(ctx context.Context, key string) (*FileObject, error) {
	fullKey := s.fullKey(key)
	out, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(fullKey),
	})
	if err != nil {
		return nil, TranslateError(err)
	}

	fo := &FileObject{
		Key:         key,
		Size:        *out.ContentLength,
		ContentType: *out.ContentType,
	}
	if out.LastModified != nil {
		fo.LastModified = *out.LastModified
	}
	if out.ETag != nil {
		etag := NormalizeETag(*out.ETag)
		fo.ETag = etag
		fo.Checksum = ExtractMD5FromETag(etag)
	}
	if out.Metadata != nil {
		fo.Metadata = make(map[string]string, len(out.Metadata))
		for k, v := range out.Metadata {
			fo.Metadata[k] = v
		}
	}
	if out.StorageClass != "" {
		fo.StorageClass = string(out.StorageClass)
	}
	return fo, nil
}

func (s *s3Provider) Get(ctx context.Context, key string) (io.ReadCloser, *FileObject, error) {
	fullKey := s.fullKey(key)
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(fullKey),
	})
	if err != nil {
		return nil, nil, TranslateError(err)
	}

	fo := &FileObject{
		Key:  key,
		Size: *out.ContentLength,
	}
	if out.ContentType != nil {
		fo.ContentType = *out.ContentType
	}
	if out.LastModified != nil {
		fo.LastModified = *out.LastModified
	}
	if out.ETag != nil {
		etag := NormalizeETag(*out.ETag)
		fo.ETag = etag
		fo.Checksum = ExtractMD5FromETag(etag)
	}
	if out.Metadata != nil {
		fo.Metadata = make(map[string]string, len(out.Metadata))
		for k, v := range out.Metadata {
			fo.Metadata[k] = v
		}
	}

	return out.Body, fo, nil
}

func (s *s3Provider) GetRange(ctx context.Context, key string, offset, length int64) (io.ReadCloser, error) {
	fullKey := s.fullKey(key)
	rangeStr := fmt.Sprintf("bytes=%d-%d", offset, offset+length-1)
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(fullKey),
		Range:  aws.String(rangeStr),
	})
	if err != nil {
		return nil, TranslateError(err)
	}
	return out.Body, nil
}

func (s *s3Provider) Put(ctx context.Context, key string, body io.Reader, size int64, opts *UploadOptions) (*FileObject, error) {
	fullKey := s.fullKey(key)
	logger.Debug("S3 Put: key=%s, size=%d", fullKey, size)

	partSize := defaultPartSize
	concurrency := defaultUploadConcurrency
	if opts != nil {
		if opts.PartSize > 0 {
			partSize = opts.PartSize
		}
		if opts.Concurrency > 0 {
			concurrency = opts.Concurrency
		}
	}

	if size > 0 && size > partSize {
		partSize = calculatePartSize(size, partSize)
	}

	uploader := s.uploader
	if partSize != defaultPartSize || concurrency != defaultUploadConcurrency {
		uploader = manager.NewUploader(s.client, func(u *manager.Uploader) {
			u.PartSize = partSize
			u.Concurrency = concurrency
		})
	}

	input := &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(fullKey),
		Body:   body,
	}
	contentType := getContentType(opts, key)
	input.ContentType = aws.String(contentType)
	if opts != nil && opts.StorageClass != "" {
		input.StorageClass = s3types.StorageClass(opts.StorageClass)
	}
	if opts != nil && len(opts.Metadata) > 0 {
		input.Metadata = make(map[string]string, len(opts.Metadata))
		for k, v := range opts.Metadata {
			input.Metadata[k] = v
		}
	}

	out, err := uploader.Upload(ctx, input)
	if err != nil {
		return nil, TranslateError(err)
	}

	etag := ""
	checksum := ""
	if out.ETag != nil {
		etag = NormalizeETag(*out.ETag)
		checksum = ExtractMD5FromETag(etag)
	}

	return &FileObject{
		Key:          key,
		Size:         size,
		LastModified: time.Now(),
		ETag:         etag,
		Checksum:     checksum,
		ContentType:  contentType,
		Metadata:     getMetadata(opts),
	}, nil
}

func (s *s3Provider) PutFile(ctx context.Context, key, localPath string, opts *UploadOptions) (*FileObject, error) {
	return putFileViaReader(s, ctx, key, localPath, opts)
}

func (s *s3Provider) Delete(ctx context.Context, key string) error {
	fullKey := s.fullKey(key)
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(fullKey),
	})
	if err != nil {
		return TranslateError(err)
	}
	return nil
}

func (s *s3Provider) DeleteMany(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	logger.Debug("S3 DeleteMany: count=%d", len(keys))

	const batchSize = 1000
	for i := 0; i < len(keys); i += batchSize {
		end := i + batchSize
		if end > len(keys) {
			end = len(keys)
		}
		batch := keys[i:end]

		objects := make([]s3types.ObjectIdentifier, 0, len(batch))
		for _, k := range batch {
			fk := s.fullKey(k)
			objects = append(objects, s3types.ObjectIdentifier{Key: aws.String(fk)})
		}

		_, err := s.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: aws.String(s.bucket),
			Delete: &s3types.Delete{
				Objects: objects,
				Quiet:   aws.Bool(true),
			},
		})
		if err != nil {
			return TranslateError(err)
		}
	}
	return nil
}

func (s *s3Provider) Copy(ctx context.Context, srcKey, dstKey string) error {
	srcFull := s.fullKey(srcKey)
	dstFull := s.fullKey(dstKey)
	copySource := fmt.Sprintf("%s/%s", s.bucket, srcFull)

	_, err := s.client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(s.bucket),
		Key:        aws.String(dstFull),
		CopySource: aws.String(copySource),
	})
	if err != nil {
		return TranslateError(err)
	}
	return nil
}

func (s *s3Provider) Close() error {
	return nil
}
