package io

import (
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
)

func TestDataTypeBytesPerPixel(t *testing.T) {
	tests := []struct {
		name          string
		dataType      string
		bitsPerSample int
		want          int
	}{
		{"uint8", "uint8", 0, 1},
		{"int8", "int8", 0, 1},
		{"uint16", "uint16", 0, 2},
		{"int16", "int16", 0, 2},
		{"uint32", "uint32", 0, 4},
		{"int32", "int32", 0, 4},
		{"float32", "float32", 0, 4},
		{"float64", "float64", 0, 8},
		{"uint64", "uint64", 0, 8},
		{"int64", "int64", 0, 8},
		{"case insensitive", "UINT16", 0, 2},
		{"fallback bitsPerSample=16", "unknown", 16, 2},
		{"fallback bitsPerSample=8", "unknown", 8, 1},
		{"fallback bitsPerSample=32", "unknown", 32, 4},
		{"fallback bitsPerSample=0", "unknown", 0, 2},
		{"fallback bitsPerSample=4 rounds to 1", "unknown", 4, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DataTypeBytesPerPixel(tt.dataType, tt.bitsPerSample)
			if got != tt.want {
				t.Errorf("DataTypeBytesPerPixel(%q, %d) = %d, want %d",
					tt.dataType, tt.bitsPerSample, got, tt.want)
			}
		})
	}
}

func writeFile(t *testing.T, path string, data []byte) {
	t.Helper()
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatalf("failed to write test file %s: %v", path, err)
	}
}

func isAppErrorWithCode(err error, code apperrors.ErrorCode) bool {
	if err == nil {
		return false
	}
	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		return false
	}
	return appErr.Code == code
}

func TestNewGeoTIFFReader_EmptyFile(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "empty.tif")
	writeFile(t, path, []byte{})

	_, err := NewGeoTIFFReader(path, 64)
	if err == nil {
		t.Fatal("expected error for empty file, got nil")
	}
	t.Logf("empty file error (correct): %v", err)
}

func TestNewGeoTIFFReader_GarbageData(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "garbage.tif")
	writeFile(t, path, []byte("this is not a tiff file at all just random bytes"))

	_, err := NewGeoTIFFReader(path, 64)
	if err == nil {
		t.Fatal("expected error for garbage data, got nil")
	}
	t.Logf("garbage data error (correct): %v", err)
}

func TestNewGeoTIFFReader_InvalidMagicNumber(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "bad_magic.tif")

	buf := make([]byte, 100)
	copy(buf, []byte{0x11, 0x22, 0x33, 0x44})
	writeFile(t, path, buf)

	_, err := NewGeoTIFFReader(path, 64)
	if err == nil {
		t.Fatal("expected error for invalid magic, got nil")
	}
	t.Logf("invalid magic error (correct): %v", err)
}

func TestNewGeoTIFFReader_ValidHeaderButNoIFD(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "no_ifd.tif")

	buf := make([]byte, 256)
	binary.LittleEndian.PutUint16(buf[0:], 0x4949)
	binary.LittleEndian.PutUint16(buf[2:], 42)
	binary.LittleEndian.PutUint32(buf[4:], 0)
	writeFile(t, path, buf)

	_, err := NewGeoTIFFReader(path, 64)
	if err == nil {
		t.Fatal("expected error for missing IFD, got nil")
	}
	if !isAppErrorWithCode(err, apperrors.E1001) {
		t.Errorf("expected E1001 error code, got: %v (type %T)", err, err)
	}
	t.Logf("no IFD error (correct, E1001): %v", err)
}

func TestNewGeoTIFFReader_ShortHeader(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "short.tif")

	buf := make([]byte, 4)
	binary.LittleEndian.PutUint16(buf[0:], 0x4949)
	writeFile(t, path, buf)

	_, err := NewGeoTIFFReader(path, 64)
	if err == nil {
		t.Fatal("expected error for short header, got nil")
	}
	t.Logf("short header error (correct): %v", err)
}

func TestNewGeoTIFFReader_FileNotFound(t *testing.T) {
	_, err := NewGeoTIFFReader("/nonexistent/path/to/file.tif", 64)
	if err == nil {
		t.Fatal("expected error for missing file, got nil")
	}
	if !isAppErrorWithCode(err, apperrors.E4001) {
		t.Errorf("expected E4001 error code, got: %v", err)
	}
	t.Logf("file not found error (correct, E4001): %v", err)
}

func TestNewGeoTIFFReader_BigEndianHeader(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "big_endian.tif")

	buf := make([]byte, 256)
	binary.BigEndian.PutUint16(buf[0:], 0x4D4D)
	binary.BigEndian.PutUint16(buf[2:], 42)
	binary.BigEndian.PutUint32(buf[4:], 0)
	writeFile(t, path, buf)

	_, err := NewGeoTIFFReader(path, 64)
	if err == nil {
		t.Fatal("expected error for big endian header with no IFD, got nil")
	}
	t.Logf("big endian no IFD error (correct): %v", err)
}

func TestDetectSensorFromFilename(t *testing.T) {
	tests := []struct {
		path string
		want string
	}{
		{"/data/S2A_MSIL2A.tif", "sentinel2"},
		{"/data/sentinel2_b1.tiff", "sentinel2"},
		{"/data/LC08_L1TP.tif", "landsat8"},
		{"/data/landsat8_scene.img", "landsat8"},
		{"/data/GF2_PMS1.tif", "gf2"},
		{"/data/gaofen2_image.tif", "gf2"},
		{"/data/unknown.tif", "unknown"},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := detectSensorFromFilename(tt.path)
			if string(got) != tt.want {
				t.Errorf("detectSensorFromFilename(%q) = %q, want %q", tt.path, got, tt.want)
			}
		})
	}
}

func TestFindGeoTIFFFiles(t *testing.T) {
	tmpDir := t.TempDir()

	files := []string{"a.tif", "b.TIFF", "c.img", "d.jpg", "e.png"}
	for _, f := range files {
		writeFile(t, filepath.Join(tmpDir, f), []byte("dummy"))
	}

	subDir := filepath.Join(tmpDir, "sub")
	if err := os.Mkdir(subDir, 0755); err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(subDir, "nested.tif"), []byte("dummy"))

	t.Run("non recursive", func(t *testing.T) {
		result, err := FindGeoTIFFFiles(tmpDir, false)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 3 {
			t.Errorf("expected 3 files, got %d: %v", len(result), result)
		}
	})

	t.Run("recursive", func(t *testing.T) {
		result, err := FindGeoTIFFFiles(tmpDir, true)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 4 {
			t.Errorf("expected 4 files (recursive), got %d: %v", len(result), result)
		}
	})

	t.Run("directory not found", func(t *testing.T) {
		_, err := FindGeoTIFFFiles("/nonexistent", false)
		if err == nil {
			t.Fatal("expected error for missing directory")
		}
	})
}
