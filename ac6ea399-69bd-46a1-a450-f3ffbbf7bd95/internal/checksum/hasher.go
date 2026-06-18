package checksum

import (
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash"
	"io"
	"os"
	"sync"

	"cloudsync/internal/config"
)

type Hasher struct {
	algorithm config.ChecksumAlgorithm
	pool      sync.Pool
}

type FileChecksum struct {
	Algorithm config.ChecksumAlgorithm `json:"algorithm"`
	Value     string                  `json:"value"`
	Size      int64                   `json:"size"`
}

func New(algorithm config.ChecksumAlgorithm) *Hasher {
	h := &Hasher{
		algorithm: algorithm,
	}
	h.pool.New = func() interface{} {
		return createHash(algorithm)
	}
	return h
}

func createHash(algorithm config.ChecksumAlgorithm) hash.Hash {
	switch algorithm {
	case config.ChecksumSHA256:
		return sha256.New()
	default:
		return md5.New()
	}
}

func (h *Hasher) Algorithm() config.ChecksumAlgorithm {
	return h.algorithm
}

func (h *Hasher) ComputeFromReader(r io.Reader) (string, int64, error) {
	hasher := h.pool.Get().(hash.Hash)
	defer func() {
		hasher.Reset()
		h.pool.Put(hasher)
	}()

	buf := make([]byte, 64*1024)
	var total int64
	for {
		n, err := r.Read(buf)
		if n > 0 {
			hasher.Write(buf[:n])
			total += int64(n)
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", total, fmt.Errorf("read data: %w", err)
		}
	}

	sum := hex.EncodeToString(hasher.Sum(nil))
	return sum, total, nil
}

type HashingReader struct {
	reader io.Reader
	hasher hash.Hash
	pool   *sync.Pool
	total  int64
}

func (h *Hasher) NewHashingReader(r io.Reader) *HashingReader {
	hashImpl := h.pool.Get().(hash.Hash)
	hashImpl.Reset()
	return &HashingReader{
		reader: r,
		hasher: hashImpl,
		pool:   &h.pool,
	}
}

func (hr *HashingReader) Read(p []byte) (int, error) {
	n, err := hr.reader.Read(p)
	if n > 0 {
		hr.hasher.Write(p[:n])
		hr.total += int64(n)
	}
	return n, err
}

func (hr *HashingReader) Sum() string {
	return hex.EncodeToString(hr.hasher.Sum(nil))
}

func (hr *HashingReader) Size() int64 {
	return hr.total
}

func (hr *HashingReader) Close() error {
	hr.hasher.Reset()
	hr.pool.Put(hr.hasher)
	if rc, ok := hr.reader.(io.Closer); ok {
		return rc.Close()
	}
	return nil
}

func (h *Hasher) ComputeFromFile(path string) (*FileChecksum, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	value, size, err := h.ComputeFromReader(f)
	if err != nil {
		return nil, err
	}

	return &FileChecksum{
		Algorithm: h.algorithm,
		Value:     value,
		Size:      size,
	}, nil
}

func (h *Hasher) ComputeFromBytes(data []byte) string {
	hasher := h.pool.Get().(hash.Hash)
	defer func() {
		hasher.Reset()
		h.pool.Put(hasher)
	}()
	hasher.Write(data)
	return hex.EncodeToString(hasher.Sum(nil))
}

func (h *Hasher) VerifyFile(path string, expected string) (bool, *FileChecksum, error) {
	actual, err := h.ComputeFromFile(path)
	if err != nil {
		return false, nil, err
	}
	return actual.Value == expected, actual, nil
}

func (h *Hasher) VerifyReader(r io.Reader, expected string) (bool, int64, error) {
	actual, size, err := h.ComputeFromReader(r)
	if err != nil {
		return false, size, err
	}
	return actual == expected, size, nil
}

func (h *Hasher) Compare(a, b *FileChecksum) bool {
	if a == nil || b == nil {
		return false
	}
	if a.Algorithm != b.Algorithm {
		return false
	}
	if a.Size != b.Size {
		return false
	}
	return a.Value == b.Value
}

type MismatchReport struct {
	Path     string                  `json:"path"`
	Expected string                  `json:"expected"`
	Actual   string                  `json:"actual"`
	Algorithm config.ChecksumAlgorithm `json:"algorithm"`
	Reason   string                  `json:"reason"`
}

type Verifier struct {
	hasher        *Hasher
	mismatches    []MismatchReport
	mismatchesMu  sync.Mutex
	totalChecked  int64
	totalMu       sync.Mutex
}

func NewVerifier(algorithm config.ChecksumAlgorithm) *Verifier {
	return &Verifier{
		hasher: New(algorithm),
	}
}

func (v *Verifier) Hasher() *Hasher {
	return v.hasher
}

func (v *Verifier) VerifyFile(path string, expectedChecksum string) bool {
	v.totalMu.Lock()
	v.totalChecked++
	v.totalMu.Unlock()

	match, actual, err := v.hasher.VerifyFile(path, expectedChecksum)
	if err != nil {
		v.addMismatch(path, expectedChecksum, "", fmt.Sprintf("error: %v", err))
		return false
	}
	if !match {
		v.addMismatch(path, expectedChecksum, actual.Value, "checksum mismatch")
		return false
	}
	return true
}

func (v *Verifier) VerifyReader(r io.Reader, expectedChecksum string) bool {
	v.totalMu.Lock()
	v.totalChecked++
	v.totalMu.Unlock()

	match, _, err := v.hasher.VerifyReader(r, expectedChecksum)
	if err != nil {
		v.addMismatch("<reader>", expectedChecksum, "", fmt.Sprintf("error: %v", err))
		return false
	}
	if !match {
		v.addMismatch("<reader>", expectedChecksum, "", "checksum mismatch")
		return false
	}
	return true
}

func (v *Verifier) addMismatch(path, expected, actual, reason string) {
	v.mismatchesMu.Lock()
	defer v.mismatchesMu.Unlock()
	v.mismatches = append(v.mismatches, MismatchReport{
		Path:      path,
		Expected:  expected,
		Actual:    actual,
		Algorithm: v.hasher.algorithm,
		Reason:    reason,
	})
}

func (v *Verifier) AddMismatch(path, expected, actual, reason string) {
	v.addMismatch(path, expected, actual, reason)
}

func (v *Verifier) Mismatches() []MismatchReport {
	v.mismatchesMu.Lock()
	defer v.mismatchesMu.Unlock()
	result := make([]MismatchReport, len(v.mismatches))
	copy(result, v.mismatches)
	return result
}

func (v *Verifier) TotalChecked() int64 {
	v.totalMu.Lock()
	defer v.totalMu.Unlock()
	return v.totalChecked
}

func (v *Verifier) MismatchCount() int {
	v.mismatchesMu.Lock()
	defer v.mismatchesMu.Unlock()
	return len(v.mismatches)
}

func (v *Verifier) AllMatched() bool {
	return v.MismatchCount() == 0
}

func ParseChecksum(hexStr string) ([]byte, error) {
	if len(hexStr) == 0 {
		return nil, fmt.Errorf("empty checksum string")
	}
	b, err := hex.DecodeString(hexStr)
	if err != nil {
		return nil, fmt.Errorf("invalid hex string: %w", err)
	}
	return b, nil
}

func ToHex(data []byte) string {
	return hex.EncodeToString(data)
}
