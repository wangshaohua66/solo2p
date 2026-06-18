package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"cloudsync/internal/logger"
)

const (
	minPartSize       int64 = 5 * 1024 * 1024
	defaultPartSize   int64 = 8 * 1024 * 1024
	maxPartCount      int64 = 10000
	multipartThreshold int64 = 5 * 1024 * 1024
	defaultUploadConcurrency = 5
	maxStreamBufferSize       = 512 * 1024 * 1024
)

func calculatePartSize(size int64, basePartSize int64) int64 {
	if basePartSize < minPartSize {
		basePartSize = minPartSize
	}
	if size <= 0 {
		return basePartSize
	}
	partSize := basePartSize
	for size/partSize > maxPartCount {
		partSize *= 2
	}
	return partSize
}

type streamingUploader interface {
	Put(ctx context.Context, key string, body io.Reader, size int64, opts *UploadOptions) (*FileObject, error)
}

func putFileViaReader(p streamingUploader, ctx context.Context, key, localPath string, opts *UploadOptions) (*FileObject, error) {
	f, err := os.Open(localPath)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("stat file: %w", err)
	}

	return p.Put(ctx, key, f, info.Size(), opts)
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
		result := make(map[string]string, len(opts.Metadata))
		for k, v := range opts.Metadata {
			result[k] = v
		}
		return result
	}
	return map[string]string{}
}

type chunkReader struct {
	reader   io.Reader
	chunkSize int64
}

func newChunkReader(r io.Reader, chunkSize int64) *chunkReader {
	return &chunkReader{
		reader:    r,
		chunkSize: chunkSize,
	}
}

func (cr *chunkReader) ReadChunk() ([]byte, error) {
	buf := make([]byte, cr.chunkSize)
	n, err := io.ReadFull(cr.reader, buf)
	if n > 0 {
		return buf[:n], nil
	}
	if err == io.EOF || err == io.ErrUnexpectedEOF {
		return nil, io.EOF
	}
	return nil, err
}

type progressReader struct {
	reader    io.Reader
	total     int64
	read      int64
	onProgress func(read int64, total int64)
}

func newProgressReader(r io.Reader, total int64, onProgress func(int64, int64)) *progressReader {
	return &progressReader{
		reader:    r,
		total:     total,
		onProgress: onProgress,
	}
}

func (pr *progressReader) Read(p []byte) (int, error) {
	n, err := pr.reader.Read(p)
	pr.read += int64(n)
	if pr.onProgress != nil {
		pr.onProgress(pr.read, pr.total)
	}
	return n, err
}

func logTransferRate(key string, size int64, duration float64) {
	if duration > 0 {
		rate := float64(size) / duration
		logger.Debug("Transfer rate: %s = %.2f MB/s", key, rate/(1024*1024))
	}
}
