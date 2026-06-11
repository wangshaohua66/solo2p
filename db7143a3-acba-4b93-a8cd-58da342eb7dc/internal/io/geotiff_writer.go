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
	headerDone  bool
	ifdOffset   int64
	dataOffset  int64
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

func (w *GeoTIFFWriter) writeHeaderAndIFD() error {
	if w.headerDone {
		return nil
	}
	bo := w.byteOrder
	width := uint32(w.metadata.Width)
	height := uint32(w.metadata.Height)
	numBands := uint16(w.metadata.NumBands)
	bps := uint16(w.metadata.BitsPerSample)
	var sampleFmt uint16 = 1
	switch w.metadata.DataType {
	case "float32":
		sampleFmt = 3
	case "float64":
		sampleFmt = 3
	case "int8", "int16", "int32", "int64":
		sampleFmt = 2
	}
	headerSize := int64(8)
	numEntries := uint16(14)
	ifdSize := int64(2 + int(numEntries)*12 + 4)
	padding := int64(128)
	w.ifdOffset = headerSize
	w.dataOffset = headerSize + ifdSize + padding

	buf := make([]byte, 8)
	buf[0] = 'I'
	buf[1] = 'I'
	bo.PutUint16(buf[2:4], 42)
	bo.PutUint32(buf[4:8], uint32(w.ifdOffset))
	if _, err := w.file.WriteAt(buf, 0); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, "cannot write TIFF header")
	}

	entryIdx := 0
	entries := make([]byte, ifdSize)
	addEntry := func(tag, typ uint16, count uint32, valueOrOffset uint32) {
		off := 2 + entryIdx*12
		bo.PutUint16(entries[off:off+2], tag)
		bo.PutUint16(entries[off+2:off+4], typ)
		bo.PutUint32(entries[off+4:off+8], count)
		bo.PutUint32(entries[off+8:off+12], valueOrOffset)
		entryIdx++
	}
	bo.PutUint16(entries[0:2], numEntries)

	bpp := DataTypeBytesPerPixel(w.metadata.DataType, w.metadata.BitsPerSample)
	totalPixels := uint64(w.metadata.Width) * uint64(w.metadata.Height) * uint64(numBands)
	stripBytes := uint32(totalPixels * uint64(bpp))
	addEntry(256, 4, 1, width)
	addEntry(257, 4, 1, height)
	addEntry(258, 3, uint32(numBands), uint32(bps)<<16|uint32(bps))
	addEntry(259, 3, 1, 1)
	addEntry(262, 3, 1, 1)
	addEntry(273, 4, 1, uint32(w.dataOffset))
	addEntry(277, 3, 1, uint32(numBands))
	addEntry(278, 4, 1, height)
	addEntry(279, 4, 1, stripBytes)
	addEntry(284, 3, 1, 1)
	addEntry(339, 3, uint32(numBands), uint32(sampleFmt))

	extraIdx := int64(w.dataOffset) - 64
	if extraIdx < int64(headerSize+ifdSize) {
		extraIdx = int64(headerSize + ifdSize)
	}
	modelTransform := make([]byte, 16*8)
	mtOff := extraIdx
	px := w.metadata.GeoTransform.PixelWidth
	py := w.metadata.GeoTransform.PixelHeight
	rx := w.metadata.GeoTransform.RotationX
	ry := w.metadata.GeoTransform.RotationY
	ox := w.metadata.GeoTransform.OriginX
	oy := w.metadata.GeoTransform.OriginY
	bo.PutUint64(modelTransform[0:8], math.Float64bits(px))
	bo.PutUint64(modelTransform[8:16], math.Float64bits(rx))
	bo.PutUint64(modelTransform[16:24], 0)
	bo.PutUint64(modelTransform[24:32], math.Float64bits(ox))
	bo.PutUint64(modelTransform[32:40], math.Float64bits(ry))
	bo.PutUint64(modelTransform[40:48], math.Float64bits(py))
	bo.PutUint64(modelTransform[48:56], 0)
	bo.PutUint64(modelTransform[56:64], math.Float64bits(oy))
	bo.PutUint64(modelTransform[64:72], 0)
	bo.PutUint64(modelTransform[72:80], 0)
	bo.PutUint64(modelTransform[80:88], 1)
	bo.PutUint64(modelTransform[88:96], 0)
	bo.PutUint64(modelTransform[96:104], 0)
	bo.PutUint64(modelTransform[104:112], 0)
	bo.PutUint64(modelTransform[112:120], 0)
	bo.PutUint64(modelTransform[120:128], 1)
	if _, err := w.file.WriteAt(modelTransform, mtOff); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, "cannot write ModelTransformationTag")
	}
	addEntry(34264, 12, 16, uint32(mtOff))

	epsgOff := mtOff + 128
	epsgKeys := make([]byte, 8*2)
	bo.PutUint16(epsgKeys[0:2], 1)
	bo.PutUint16(epsgKeys[2:4], 1)
	bo.PutUint16(epsgKeys[4:6], 0)
	bo.PutUint16(epsgKeys[6:8], 1)
	bo.PutUint16(epsgKeys[8:10], 3072)
	bo.PutUint16(epsgKeys[10:12], 0)
	bo.PutUint16(epsgKeys[12:14], 1)
	epsgCode := uint16(4326)
	if w.metadata.EPSGCode > 0 {
		epsgCode = uint16(w.metadata.EPSGCode)
	}
	bo.PutUint16(epsgKeys[14:16], epsgCode)
	if _, err := w.file.WriteAt(epsgKeys, epsgOff); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, "cannot write GeoKeyDirectory")
	}
	addEntry(34735, 3, 8, uint32(epsgOff))

	if _, err := w.file.WriteAt(entries, w.ifdOffset); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, "cannot write IFD entries")
	}

	w.headerDone = true
	return nil
}

func (w *GeoTIFFWriter) WriteChunk(chunk *types.Chunk) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if !w.headerDone {
		if err := w.writeHeaderAndIFD(); err != nil {
			return err
		}
	}
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
	width := w.metadata.Width
	numBands := w.metadata.NumBands
	totalValues := rows * width * numBands
	byteData := make([]byte, totalValues*bpp)
	for y := 0; y < rows; y++ {
		for x := 0; x < width; x++ {
			srcIdx := y*cols + x
			dstBase := (y*width + x) * numBands * bpp
			for b := 0; b < numBands; b++ {
				if b >= bands || srcIdx >= len(data[b]) {
					continue
				}
				val := data[b][srcIdx]
				off := dstBase + b*bpp
				switch bpp {
				case 1:
					byteData[off] = byte(math.Max(0, math.Min(255, val)))
				case 2:
					uval := uint16(math.Max(0, math.Min(65535, val)))
					w.byteOrder.PutUint16(byteData[off:off+2], uval)
				case 4:
					if w.metadata.DataType == "float32" {
						bits := math.Float32bits(float32(val))
						w.byteOrder.PutUint32(byteData[off:off+4], bits)
					} else {
						uval := uint32(math.Max(0, math.Min(4294967295, val)))
						w.byteOrder.PutUint32(byteData[off:off+4], uval)
					}
				case 8:
					bits := math.Float64bits(val)
					w.byteOrder.PutUint64(byteData[off:off+8], bits)
				default:
					uval := uint16(math.Max(0, math.Min(65535, val)))
					w.byteOrder.PutUint16(byteData[off:off+2], uval)
				}
			}
		}
	}
	offset := w.dataOffset + int64(chunk.OffsetY)*int64(width)*int64(numBands)*int64(bpp)
	if _, err := w.file.WriteAt(byteData, offset); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, "cannot write chunk data")
	}
	return nil
}

func (w *GeoTIFFWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file != nil {
		err := w.file.Close()
		w.file = nil
		return err
	}
	return nil
}
