package io

import (
	"encoding/binary"
	"math"
	"os"
	"path/filepath"
	"sync"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/types"
	"github.com/remote-sensing/sentinel-cli/internal/util"
)

type GeoTIFFWriter struct {
	path        string
	file        *os.File
	metadata    *types.GeoTIFFMetadata
	byteOrder   binary.ByteOrder
	chunkSizeMB int
	mu          sync.Mutex
	written     int
}

func NewGeoTIFFWriter(path string, metadata *types.GeoTIFFMetadata, chunkSizeMB int) (*GeoTIFFWriter, error) {
	expandedPath := util.ExpandPath(path)
	if err := os.MkdirAll(filepath.Dir(expandedPath), 0755); err != nil {
		return nil, apperrors.Wrap(err, apperrors.E1005, "cannot create output directory: "+filepath.Dir(expandedPath))
	}
	file, err := os.OpenFile(expandedPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.E1005, "cannot create output GeoTIFF: "+path)
	}
	return &GeoTIFFWriter{
		path: expandedPath, file: file, metadata: metadata,
		byteOrder: binary.LittleEndian, chunkSizeMB: chunkSizeMB, mu: sync.Mutex{},
	}, nil
}

func (w *GeoTIFFWriter) WriteChunk(chunk *types.Chunk) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	data, ok := chunk.Data.([][]float64)
	if !ok {
		return apperrors.New(apperrors.E1001, "invalid chunk data format")
	}
	bands := len(data)
	if bands == 0 {
		return apperrors.New(apperrors.E1001, "chunk has no bands")
	}
	rows := chunk.Height
	cols := chunk.Width
	bpp := DataTypeBytesPerPixel(w.metadata.DataType, w.metadata.BitsPerSample)
	totalValues := bands * rows * cols
	byteData := make([]byte, totalValues*bpp)
	idx := 0
	for b := 0; b < bands; b++ {
		bd := data[b]
		for i := 0; i < rows*cols; i++ {
			switch bpp {
			case 1:
				byteData[idx] = byte(math.Max(0, math.Min(255, bd[i])))
				idx++
			case 2:
				val := uint16(math.Max(0, math.Min(65535, bd[i])))
				binary.LittleEndian.PutUint16(byteData[idx:idx+2], val)
				idx += 2
			case 4:
				if w.metadata.DataType == "float32" {
					bits := math.Float32bits(float32(bd[i]))
					binary.LittleEndian.PutUint32(byteData[idx:idx+4], bits)
				} else {
					val := uint32(math.Max(0, math.Min(4294967295, bd[i])))
					binary.LittleEndian.PutUint32(byteData[idx:idx+4], val)
				}
				idx += 4
			case 8:
				bits := math.Float64bits(bd[i])
				binary.LittleEndian.PutUint64(byteData[idx:idx+8], bits)
				idx += 8
			default:
				val := uint16(math.Max(0, math.Min(65535, bd[i])))
				binary.LittleEndian.PutUint16(byteData[idx:idx+2], val)
				idx += 2
			}
		}
	}
	if chunk.ChunkIndex == 0 && w.written == 0 {
		header := make([]byte, 8)
		header[0] = 'I'
		header[1] = 'I'
		binary.LittleEndian.PutUint16(header[2:4], 42)
		headerBytes := int64(8 + 2 + 16*12 + 4 + 128)
		binary.LittleEndian.PutUint32(header[4:8], uint32(headerBytes))
		if _, err := w.file.WriteAt(header, 0); err != nil {
			return apperrors.Wrap(err, apperrors.E1005, "cannot write TIFF header")
		}
	}
	offset := int64(8+2+16*12+4+128) + int64(chunk.OffsetY)*int64(cols)*int64(bands)*int64(bpp)
	if _, err := w.file.WriteAt(byteData, offset); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, "cannot write chunk data")
	}
	w.written += len(byteData)
	return nil
}

func (w *GeoTIFFWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file != nil {
		return w.file.Close()
	}
	return nil
}
