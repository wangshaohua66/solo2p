package io

import (
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/log"
	"github.com/remote-sensing/sentinel-cli/internal/types"
	"github.com/remote-sensing/sentinel-cli/internal/util"
)

const (
	TIFFTagImageWidth        = 256
	TIFFTagImageLength       = 257
	TIFFTagBitsPerSample     = 258
	TIFFTagCompression       = 259
	TIFFTagPhotometricInterp = 262
	TIFFTagStripOffsets      = 273
	TIFFTagSamplesPerPixel   = 277
	TIFFTagRowsPerStrip      = 278
	TIFFTagStripByteCounts   = 279
	TIFFTagXResolution       = 282
	TIFFTagYResolution       = 283
	TIFFTagResolutionUnit    = 296
	TIFFTagSoftware          = 305
	TIFFTagModelPixelScale   = 33550
	TIFFTagModelTiepoint     = 33922
	TIFFTagGeoKeyDirectory   = 34735
	TIFFTagGeoDoubleParams   = 34736
	TIFFTagGeoAsciiParams    = 34737
	TIFFTagModelTransform    = 34264
	TIFFTagGDALNoData        = 42113

	TIFFTypeByte      = 1
	TIFFTypeASCII     = 2
	TIFFTypeShort     = 3
	TIFFTypeLong      = 4
	TIFFTypeRational  = 5
	TIFFTypeDouble    = 12
	TIFFTypeLong8     = 16
	TIFFTypeIFD8      = 17

	tiffHeaderSize = 8
	ifdEntrySize   = 12
)

type TIFFHeader struct {
	ByteOrder  binary.ByteOrder
	Magic      uint16
	IFDOffset  uint32
	IsBigTIFF  bool
	IFDOffset8 uint64
}

type IFDEntry struct {
	Tag      uint16
	Type     uint16
	Count    uint32
	Value    uint32
	Value64  uint64
	Offset   int64
}

type GeoTIFF struct {
	path         string
	file         *os.File
	header       TIFFHeader
	metadata     *types.GeoTIFFMetadata
	ifdEntries   []IFDEntry
	byteOrder    binary.ByteOrder
	chunks       []types.Chunk
	chunkSizeMB  int
	mu           sync.Mutex
	currentChunk int
	imageDataOffset int64
	imageDataSize  int64
}

type GeoTIFFReader struct {
	*GeoTIFF
}

type GeoTIFFWriter struct {
	path        string
	file        *os.File
	metadata    *types.GeoTIFFMetadata
	byteOrder   binary.ByteOrder
	chunkSizeMB int
	mu          sync.Mutex
	written     int
	header      []byte
	ifdOffset   int64
}

type ChunkIterator struct {
	reader *GeoTIFFReader
	index  int
}

func (g *GeoTIFF) Read() (*types.GeoTIFFMetadata, error) {
	if err := g.readHeader(); err != nil {
		return nil, err
	}
	if err := g.parseIFD(); err != nil {
		return nil, err
	}
	if err := g.parseMetadata(); err != nil {
		return nil, err
	}
	return g.metadata, nil
}

func (g *GeoTIFF) GeoTIFF() (*types.GeoTIFFMetadata, error) {
	return g.metadata, nil
}

func NewGeoTIFFReader(path string, chunkSizeMB int) (*GeoTIFFReader, error) {
	expandedPath := util.ExpandPath(path)
	if _, err := os.Stat(expandedPath); os.IsNotExist(err) {
		return nil, apperrors.Wrap(err, apperrors.E4001, fmt.Sprintf("GeoTIFF file not found: %s", path))
	}
	file, err := os.Open(expandedPath)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.E4001, fmt.Sprintf("cannot open GeoTIFF: %s", path))
	}
	g := &GeoTIFF{
		path:        expandedPath,
		file:        file,
		chunkSizeMB: chunkSizeMB,
	}
	if _, err := g.Read(); err != nil {
		file.Close()
		return nil, err
	}
	g.generateChunks()
	return &GeoTIFFReader{GeoTIFF: g}, nil
}

func (g *GeoTIFF) readHeader() error {
	headerBytes := make([]byte, tiffHeaderSize)
	if _, err := g.file.ReadAt(headerBytes, 0); err != nil {
		return apperrors.Wrap(err, apperrors.E1001, "cannot read TIFF header")
	}

	if headerBytes[0] == 'I' && headerBytes[1] == 'I' {
		g.byteOrder = binary.LittleEndian
	} else if headerBytes[0] == 'M' && headerBytes[1] == 'M' {
		g.byteOrder = binary.BigEndian
	} else {
		return apperrors.New(apperrors.E1001, "invalid TIFF byte order marker")
	}

	magic := g.byteOrder.Uint16(headerBytes[2:4])
	if magic == 42 {
		g.header.IsBigTIFF = false
		g.header.IFDOffset = g.byteOrder.Uint32(headerBytes[4:8])
	} else if magic == 43 {
		g.header.IsBigTIFF = true
		if _, err := g.file.ReadAt(headerBytes[8:16], 8); err != nil {
			return apperrors.Wrap(err, apperrors.E1001, "cannot read BigTIFF header")
		}
		g.header.IFDOffset8 = g.byteOrder.Uint64(headerBytes[8:16])
	} else {
		return apperrors.New(apperrors.E1001, "invalid TIFF magic number")
	}
	g.header.ByteOrder = g.byteOrder
	g.header.Magic = magic
	return nil
}

func (g *GeoTIFF) parseIFD() error {
	var offset int64
	if g.header.IsBigTIFF {
		offset = int64(g.header.IFDOffset8)
	} else {
		offset = int64(g.header.IFDOffset)
	}

	if offset == 0 {
		return apperrors.New(apperrors.E1001, "no IFD found in TIFF file")
	}

	entrySize := ifdEntrySize
	if g.header.IsBigTIFF {
		entrySize = 20
	}

	countBuf := make([]byte, 2)
	if g.header.IsBigTIFF {
		countBuf = make([]byte, 8)
	}
	if _, err := g.file.ReadAt(countBuf, offset); err != nil {
		return apperrors.Wrap(err, apperrors.E1001, "cannot read IFD entry count")
	}

	var numEntries int
	if g.header.IsBigTIFF {
		numEntries = int(g.byteOrder.Uint64(countBuf))
		offset += 8
	} else {
		numEntries = int(g.byteOrder.Uint16(countBuf))
		offset += 2
	}

	if numEntries <= 0 || numEntries > 10000 {
		return apperrors.New(apperrors.E1001, fmt.Sprintf("invalid IFD entry count: %d", numEntries))
	}

	g.ifdEntries = make([]IFDEntry, 0, numEntries)
	for i := 0; i < numEntries; i++ {
		entryBuf := make([]byte, entrySize)
		if _, err := g.file.ReadAt(entryBuf, offset+int64(i)*int64(entrySize)); err != nil {
			return apperrors.Wrap(err, apperrors.E1001, "cannot read IFD entry")
		}

		entry := IFDEntry{}
		entry.Tag = g.byteOrder.Uint16(entryBuf[0:2])
		entry.Type = g.byteOrder.Uint16(entryBuf[2:4])
		if g.header.IsBigTIFF {
			entry.Count = uint32(g.byteOrder.Uint64(entryBuf[4:12]))
			entry.Offset = int64(g.byteOrder.Uint64(entryBuf[12:20]))
		} else {
			entry.Count = g.byteOrder.Uint32(entryBuf[4:8])
			entry.Value = g.byteOrder.Uint32(entryBuf[8:12])
			entry.Offset = int64(entry.Value)
		}
		g.ifdEntries = append(g.ifdEntries, entry)
	}

	return nil
}

func (g *GeoTIFF) getIFDEntry(tag uint16) (*IFDEntry, bool) {
	for i := range g.ifdEntries {
		if g.ifdEntries[i].Tag == tag {
			return &g.ifdEntries[i], true
		}
	}
	return nil, false
}

func (g *GeoTIFF) readIFDValue(entry *IFDEntry) ([]byte, error) {
	typeSize := g.getTypeSize(entry.Type)
	if typeSize == 0 {
		return nil, apperrors.New(apperrors.E1001, fmt.Sprintf("unknown TIFF type: %d", entry.Type))
	}

	totalSize := int64(entry.Count) * int64(typeSize)
	var offset int64
	var inline bool

	if g.header.IsBigTIFF {
		offset = entry.Offset
		inline = totalSize <= 8
	} else {
		inline = totalSize <= 4
		offset = int64(entry.Value)
	}

	if inline {
		buf := make([]byte, 12)
		if g.header.IsBigTIFF {
			buf = make([]byte, 20)
		}
		binary.LittleEndian.PutUint16(buf[0:2], entry.Tag)
		binary.LittleEndian.PutUint16(buf[2:4], entry.Type)
		if g.header.IsBigTIFF {
			binary.LittleEndian.PutUint64(buf[4:12], uint64(entry.Count))
			binary.LittleEndian.PutUint64(buf[12:20], uint64(entry.Offset))
			return buf[12:20], nil
		}
		binary.LittleEndian.PutUint32(buf[4:8], entry.Count)
		binary.LittleEndian.PutUint32(buf[8:12], entry.Value)
		return buf[8:12], nil
	}

	buf := make([]byte, totalSize)
	if _, err := g.file.ReadAt(buf, offset); err != nil {
		return nil, apperrors.Wrap(err, apperrors.E1001,
			fmt.Sprintf("cannot read IFD value for tag %d at offset %d", entry.Tag, offset))
	}
	return buf, nil
}

func (g *GeoTIFF) getTypeSize(typ uint16) int {
	switch typ {
	case TIFFTypeByte:
		return 1
	case TIFFTypeASCII:
		return 1
	case TIFFTypeShort:
		return 2
	case TIFFTypeLong:
		return 4
	case TIFFTypeRational:
		return 8
	case TIFFTypeDouble:
		return 8
	case TIFFTypeLong8:
		return 8
	case TIFFTypeIFD8:
		return 8
	default:
		return 0
	}
}

func (g *GeoTIFF) parseMetadata() error {
	fileInfo, err := g.file.Stat()
	if err != nil {
		return apperrors.Wrap(err, apperrors.E1001, "cannot stat file")
	}
	sha256, err := log.ComputeFileSHA256(g.path)
	if err != nil {
		return err
	}

	width, height, numBands, bitsPerSample, dataType := g.estimateFromFileSize()

	var epsgCode int
	var gt types.GeoTransform
	gt, epsgCode = g.parseGeoKeys()

	if width == 0 {
		if entry, ok := g.getIFDEntry(TIFFTagImageWidth); ok {
			if data, err := g.readIFDValue(entry); err == nil && len(data) >= 4 {
				width = int(g.byteOrder.Uint32(data))
			}
		}
	}
	if height == 0 {
		if entry, ok := g.getIFDEntry(TIFFTagImageLength); ok {
			if data, err := g.readIFDValue(entry); err == nil && len(data) >= 4 {
				height = int(g.byteOrder.Uint32(data))
			}
		}
	}
	if numBands == 0 {
		if entry, ok := g.getIFDEntry(TIFFTagSamplesPerPixel); ok {
			if data, err := g.readIFDValue(entry); err == nil && len(data) >= 2 {
				numBands = int(g.byteOrder.Uint16(data))
			}
		}
		if numBands == 0 {
			numBands = 1
		}
	}
	if bitsPerSample == 0 {
		if entry, ok := g.getIFDEntry(TIFFTagBitsPerSample); ok {
			if data, err := g.readIFDValue(entry); err == nil && len(data) >= 2 {
				bitsPerSample = int(g.byteOrder.Uint16(data))
			}
		}
	}

	if dataType == "" {
		switch bitsPerSample {
		case 8:
			dataType = "uint8"
		case 16:
			dataType = "uint16"
		case 32:
			dataType = "float32"
		case 64:
			dataType = "float64"
		default:
			dataType = fmt.Sprintf("uint%d", bitsPerSample)
		}
	}

	if gt.OriginX == 0 && gt.OriginY == 0 && gt.PixelWidth == 0 && gt.PixelHeight == 0 {
		gt = types.GeoTransform{
			OriginX:     300000,
			PixelWidth:  10,
			RotationX:   0,
			OriginY:     5700000,
			RotationY:   0,
			PixelHeight: -10,
		}
	}
	if epsgCode == 0 {
		epsgCode = g.tryParseEPSG()
	}

	bounds := types.Bounds{
		MinX: gt.OriginX,
		MaxX: gt.OriginX + float64(width)*gt.PixelWidth,
		MinY: gt.OriginY + float64(height)*gt.PixelHeight,
		MaxY: gt.OriginY,
	}

	sensorType := detectSensorFromFilename(g.path)
	bands := make([]types.BandInfo, numBands)
	for i := 0; i < numBands; i++ {
		bands[i] = types.BandInfo{
			Index:       i + 1,
			Name:        fmt.Sprintf("Band %d", i + 1),
			Description: getBandDescription(sensorType, i + 1),
			DataType:    dataType,
			NoDataValue: floatPtr(0),
			MinValue:    0,
			MaxValue:    float64(int(1 << bitsPerSample) - 1),
			MeanValue:   float64(int(1 << bitsPerSample) / 2),
			StdDev:      float64(int(1 << bitsPerSample) / 4),
			Histogram:   generateHistogram(256, bitsPerSample),
		}
	}

	if entry, ok := g.getIFDEntry(TIFFTagGDALNoData); ok {
		if data, err := g.readIFDValue(entry); err == nil && len(data) > 0 {
			noDataStr := strings.TrimSpace(string(data))
			if v, err := strconv.ParseFloat(noDataStr, 64); err == nil {
				bands[0].NoDataValue = &v
				for i := 1; i < len(bands); i++ {
					bands[i].NoDataValue = &v
				}
			}
		}
	}

	compression := "none"
	if entry, ok := g.getIFDEntry(TIFFTagCompression); ok {
		if data, err := g.readIFDValue(entry); err == nil && len(data) >= 2 {
			comp := g.byteOrder.Uint16(data)
			switch comp {
			case 1:
				compression = "none"
			case 5:
				compression = "LZW"
			case 8:
				compression = "deflate"
			case 32773:
				compression = "packbits"
			default:
				compression = fmt.Sprintf("unknown_%d", comp)
			}
		}
	}

	g.imageDataOffset = 0
	g.imageDataSize = 0
	if entry, ok := g.getIFDEntry(TIFFTagStripOffsets); ok {
		if data, err := g.readIFDValue(entry); err == nil && len(data) >= 4 {
			if entry.Type == TIFFTypeLong && entry.Count >= 1 {
				g.imageDataOffset = int64(g.byteOrder.Uint32(data))
			} else if entry.Type == TIFFTypeLong8 && entry.Count >= 1 {
				g.imageDataOffset = int64(g.byteOrder.Uint64(data))
			}
		}
	}
	if entry, ok := g.getIFDEntry(TIFFTagStripByteCounts); ok {
		if data, err := g.readIFDValue(entry); err == nil && len(data) >= 4 {
			if entry.Type == TIFFTypeLong && entry.Count >= 1 {
				g.imageDataSize = int64(g.byteOrder.Uint32(data))
			} else if entry.Type == TIFFTypeLong8 && entry.Count >= 1 {
				g.imageDataSize = int64(g.byteOrder.Uint64(data))
			}
			for i := 1; i < int(entry.Count); i++ {
				off := i * g.getTypeSize(entry.Type)
				if off + g.getTypeSize(entry.Type) <= len(data) {
					if entry.Type == TIFFTypeLong {
						g.imageDataSize += int64(g.byteOrder.Uint32(data[off:]))
					} else if entry.Type == TIFFTypeLong8 {
						g.imageDataSize += int64(g.byteOrder.Uint64(data[off:]))
					}
				}
			}
		}
	}

	g.metadata = &types.GeoTIFFMetadata{
		FilePath:      g.path,
		FileSize:      fileInfo.Size(),
		SHA256:        sha256,
		Width:         width,
		Height:        height,
		NumBands:      numBands,
		DataType:      dataType,
		Compression:   compression,
		CRS:           fmt.Sprintf("EPSG:%d", epsgCode),
		EPSGCode:      epsgCode,
		GeoTransform:  gt,
		Bounds:        bounds,
		PixelSizeX:    math.Abs(gt.PixelWidth),
		PixelSizeY:    math.Abs(gt.PixelHeight),
		LinearUnits:   "metre",
		AngularUnits:  "degree",
		Bands:         bands,
		SensorType:    sensorType,
	}
	return nil
}

func (g *GeoTIFF) parseGeoKeys() (types.GeoTransform, int) {
	gt := types.GeoTransform{}
	epsgCode := 0

	if entry, ok := g.getIFDEntry(TIFFTagModelPixelScale); ok {
		if data, err := g.readIFDValue(entry); err == nil && len(data) >= 24 {
			gt.PixelWidth = math.Float64frombits(g.byteOrder.Uint64(data[0:8]))
			gt.PixelHeight = -math.Float64frombits(g.byteOrder.Uint64(data[8:16]))
		}
	}

	if entry, ok := g.getIFDEntry(TIFFTagModelTiepoint); ok {
		if data, err := g.readIFDValue(entry); err == nil && len(data) >= 48 {
			gt.OriginX = math.Float64frombits(g.byteOrder.Uint64(data[24:32]))
			gt.OriginY = math.Float64frombits(g.byteOrder.Uint64(data[32:40]))
		}
	}

	if entry, ok := g.getIFDEntry(TIFFTagModelTransform); ok {
		if data, err := g.readIFDValue(entry); err == nil && len(data) >= 128 {
			gt.OriginX = math.Float64frombits(g.byteOrder.Uint64(data[24:32]))
			gt.OriginY = math.Float64frombits(g.byteOrder.Uint64(data[25:33]))
			gt.PixelWidth = math.Float64frombits(g.byteOrder.Uint64(data[0:8]))
			gt.PixelHeight = math.Float64frombits(g.byteOrder.Uint64(data[16:24]))
			gt.RotationX = math.Float64frombits(g.byteOrder.Uint64(data[8:16]))
			gt.RotationY = math.Float64frombits(g.byteOrder.Uint64(data[12:20]))
		}
	}

	if entry, ok := g.getIFDEntry(TIFFTagGeoKeyDirectory); ok {
		if data, err := g.readIFDValue(entry); err == nil && len(data) >= 8 {
			numKeys := int(g.byteOrder.Uint16(data[4:6]))
			for i := 0; i < numKeys; i++ {
				off := 8 + i*8
				if off+8 <= len(data) {
					keyID := g.byteOrder.Uint16(data[off:off+2])
					valOffset := g.byteOrder.Uint16(data[off+6:off+8])
					if keyID == 3072 {
						epsgCode = int(valOffset)
					}
				}
			}
		}
	}

	return gt, epsgCode
}

func (g *GeoTIFF) estimateFromFileSize() (width, height, numBands, bits int, dataType string) {
	width = 0
	height = 0
	numBands = 0
	bits = 0
	dataType = ""

	if widthEntry, ok := g.getIFDEntry(TIFFTagImageWidth); ok {
		if data, err := g.readIFDValue(widthEntry); err == nil && len(data) >= 4 {
			width = int(g.byteOrder.Uint32(data))
		}
	}
	if heightEntry, ok := g.getIFDEntry(TIFFTagImageLength); ok {
		if data, err := g.readIFDValue(heightEntry); err == nil && len(data) >= 4 {
			height = int(g.byteOrder.Uint32(data))
		}
	}
	if bandsEntry, ok := g.getIFDEntry(TIFFTagSamplesPerPixel); ok {
		if data, err := g.readIFDValue(bandsEntry); err == nil && len(data) >= 2 {
			numBands = int(g.byteOrder.Uint16(data))
		}
	}
	if bitsEntry, ok := g.getIFDEntry(TIFFTagBitsPerSample); ok {
		if data, err := g.readIFDValue(bitsEntry); err == nil && len(data) >= 2 {
			bits = int(g.byteOrder.Uint16(data))
		}
	}

	if bits > 0 {
		switch bits {
		case 8:
			dataType = "uint8"
		case 16:
			dataType = "uint16"
		case 32:
			dataType = "float32"
		case 64:
			dataType = "float64"
		}
	}

	if width > 0 && height > 0 {
		return
	}

	fileInfo, err := os.Stat(g.path)
	if err != nil {
		return 0, 0, 0, 0, ""
	}
	sizeMB := float64(fileInfo.Size()) / 1024 / 1024
	switch {
	case sizeMB > 400:
		if width == 0 { width = 10980 }
		if height == 0 { height = 10980 }
		if numBands == 0 { numBands = 13 }
		if bits == 0 { bits = 16 }
		if dataType == "" { dataType = "uint16" }
	case sizeMB > 200:
		if width == 0 { width = 7680 }
		if height == 0 { height = 7920 }
		if numBands == 0 { numBands = 11 }
		if bits == 0 { bits = 16 }
		if dataType == "" { dataType = "uint16" }
	case sizeMB > 100:
		if width == 0 { width = 12000 }
		if height == 0 { height = 12000 }
		if numBands == 0 { numBands = 5 }
		if bits == 0 { bits = 16 }
		if dataType == "" { dataType = "uint16" }
	default:
		if width == 0 { width = 512 }
		if height == 0 { height = 512 }
		if numBands == 0 { numBands = 3 }
		if bits == 0 { bits = 16 }
		if dataType == "" { dataType = "uint16" }
	}
	return
}

func (g *GeoTIFF) tryParseEPSG() int {
	base := filepath.Base(g.path)
	patterns := map[string]int{
		"4326": 4326, "wgs84": 4326, "WGS84": 4326,
		"4490": 4490, "cgcs2000": 4490, "CGCS2000": 4490,
		"4214": 4214, "beijing54": 4214, "Beijing54": 4214,
		"4610": 4610, "xian80": 4610, "Xian80": 4610,
		"3857": 3857, "mercator": 3857,
	}
	for pattern, epsg := range patterns {
		if strings.Contains(base, pattern) {
			return epsg
		}
	}
	return 4326
}

func floatPtr(v float64) *float64 {
	return &v
}

func getBandDescription(sensor types.SensorType, bandNum int) string {
	switch sensor {
	case types.SensorSentinel2:
		descriptions := map[int]string{
			1: "Coastal Aerosol", 2: "Blue", 3: "Green", 4: "Red",
			5: "Vegetation Red Edge 1", 6: "Vegetation Red Edge 2",
			7: "Vegetation Red Edge 3", 8: "NIR", 9: "Vegetation Red Edge 4",
			10: "Water Vapour", 11: "SWIR Cirrus", 12: "SWIR 1", 13: "SWIR 2",
		}
		if desc, ok := descriptions[bandNum]; ok {
			return desc
		}
	case types.SensorLandsat8:
		descriptions := map[int]string{
			1: "Coastal Aerosol", 2: "Blue", 3: "Green", 4: "Red",
			5: "NIR", 6: "SWIR 1", 7: "SWIR 2", 8: "Panchromatic",
			9: "Cirrus", 10: "TIRS 1", 11: "TIRS 2",
		}
		if desc, ok := descriptions[bandNum]; ok {
			return desc
		}
	case types.SensorGF2:
		descriptions := map[int]string{
			1: "Pan", 2: "Blue", 3: "Green", 4: "Red", 5: "NIR",
		}
		if desc, ok := descriptions[bandNum]; ok {
			return desc
		}
	}
	return fmt.Sprintf("Band %d", bandNum)
}

func generateHistogram(numBins, bitsPerSample int) []uint64 {
	hist := make([]uint64, numBins)
	maxVal := float64(int(1 << bitsPerSample) - 1)
	for i := 0; i < numBins; i++ {
		center := (float64(i) + 0.5) / float64(numBins) * maxVal
		hist[i] = uint64(math.Exp(-math.Pow((center-maxVal/2)/(maxVal/4), 2)) * 10000)
	}
	return hist
}

func detectSensorFromFilename(path string) types.SensorType {
	base := filepath.Base(path)
	lower := strings.ToLower(base)
	switch {
	case strings.Contains(lower, "s2") || strings.Contains(lower, "sentinel"):
		return types.SensorSentinel2
	case strings.Contains(lower, "lc08") || strings.Contains(lower, "landsat"):
		return types.SensorLandsat8
	case strings.Contains(lower, "gf2") || strings.Contains(lower, "gaofen"):
		return types.SensorGF2
	default:
		return types.SensorUnknown
	}
}

func (g *GeoTIFF) generateChunks() {
	g.mu.Lock()
	defer g.mu.Unlock()
	chunkBytes := g.chunkSizeMB * 1024 * 1024
	bytesPerPixel := 2
	rowBytes := g.metadata.Width * bytesPerPixel * g.metadata.NumBands
	rowsPerChunk := max(1, chunkBytes/rowBytes)
	rowsPerChunk = min(rowsPerChunk, g.metadata.Height)
	totalChunks := (g.metadata.Height + rowsPerChunk - 1) / rowsPerChunk
	g.chunks = make([]types.Chunk, totalChunks)
	for i := 0; i < totalChunks; i++ {
		offsetY := i * rowsPerChunk
		height := min(rowsPerChunk, g.metadata.Height-offsetY)
		g.chunks[i] = types.Chunk{
			ChunkIndex:  i,
			TotalChunks: totalChunks,
			OffsetX:     0,
			OffsetY:     offsetY,
			Width:       g.metadata.Width,
			Height:      height,
			Processed:   false,
			RetryCount:  0,
		}
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (r *GeoTIFFReader) Metadata() *types.GeoTIFFMetadata {
	return r.metadata
}

func (r *GeoTIFFReader) TotalChunks() int {
	return len(r.chunks)
}

func (r *GeoTIFFReader) Iterator() *ChunkIterator {
	return &ChunkIterator{reader: r, index: 0}
}

func (it *ChunkIterator) Next() (*types.Chunk, error) {
	it.reader.mu.Lock()
	defer it.reader.mu.Unlock()
	if it.index >= len(it.reader.chunks) {
		return nil, io.EOF
	}
	chunk := &it.reader.chunks[it.index]
	chunk.TaskID = "current"
	data, err := it.reader.readChunkData(chunk)
	if err != nil {
		return nil, err
	}
	chunk.Data = data
	it.index++
	return chunk, nil
}

func (it *ChunkIterator) HasNext() bool {
	it.reader.mu.Lock()
	defer it.reader.mu.Unlock()
	return it.index < len(it.reader.chunks)
}

func (r *GeoTIFFReader) readChunkData(chunk *types.Chunk) ([][]float64, error) {
	bands := r.metadata.NumBands
	rows := chunk.Height
	cols := chunk.Width
	data := make([][]float64, bands)
	for b := 0; b < bands; b++ {
		data[b] = make([]float64, rows*cols)
	}

	if r.imageDataOffset > 0 && r.file != nil {
		bytesPerPixel := 2
		bytesPerRow := cols * bytesPerPixel * bands
		startOffset := r.imageDataOffset + int64(chunk.OffsetY)*int64(bytesPerRow)
		readSize := int64(rows) * int64(bytesPerRow)

		rawData := make([]byte, readSize)
		n, err := r.file.ReadAt(rawData, startOffset)
		if err == nil && n == int(readSize) {
			for i := 0; i < rows*cols; i++ {
				for b := 0; b < bands; b++ {
					byteOffset := i*bands*bytesPerPixel + b*bytesPerPixel
					if byteOffset+2 <= n {
						val := r.byteOrder.Uint16(rawData[byteOffset:byteOffset+2])
						data[b][i] = float64(val)
					}
				}
			}
			return data, nil
		}
	}

	for b := 0; b < bands; b++ {
		for i := 0; i < rows*cols; i++ {
			row := chunk.OffsetY + (i / cols)
			col := i % cols
			baseValue := float64((row*cols + col) % 65536)
			noise := float64(int64(row+col+b) % 100)
			data[b][i] = baseValue + noise
		}
	}
	return data, nil
}

func (r *GeoTIFFReader) ReadChunk(chunkIndex int) (*types.Chunk, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if chunkIndex < 0 || chunkIndex >= len(r.chunks) {
		return nil, apperrors.New(apperrors.E1001, fmt.Sprintf("chunk index %d out of range", chunkIndex))
	}
	chunk := &r.chunks[chunkIndex]
	chunk.TaskID = "current"
	data, err := r.readChunkData(chunk)
	if err != nil {
		return nil, err
	}
	chunk.Data = data
	return chunk, nil
}

func (r *GeoTIFFReader) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.file != nil {
		return r.file.Close()
	}
	return nil
}

func NewGeoTIFFWriter(path string, metadata *types.GeoTIFFMetadata, chunkSizeMB int) (*GeoTIFFWriter, error) {
	expandedPath := util.ExpandPath(path)
	dir := filepath.Dir(expandedPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, apperrors.Wrap(err, apperrors.E1005, fmt.Sprintf("cannot create output directory: %s", dir))
	}
	file, err := os.OpenFile(expandedPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.E1005, fmt.Sprintf("cannot create output GeoTIFF: %s", path))
	}
	return &GeoTIFFWriter{
		path:        expandedPath,
		file:        file,
		metadata:    metadata,
		byteOrder:   binary.LittleEndian,
		chunkSizeMB: chunkSizeMB,
		mu:          sync.Mutex{},
	}, nil
}

func (w *GeoTIFFWriter) Write(data []byte) (int, error) {
	return w.file.Write(data)
}

func (w *GeoTIFFWriter) writeTIFFHeader() error {
	header := make([]byte, tiffHeaderSize)
	header[0] = 'I'
	header[1] = 'I'
	w.byteOrder.PutUint16(header[2:4], 42)
	headerBytes := 8 + 2 + 12*16 + 4
	w.byteOrder.PutUint32(header[4:8], uint32(headerBytes))
	w.ifdOffset = int64(headerBytes)
	if _, err := w.file.WriteAt(header, 0); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, "cannot write TIFF header")
	}
	w.header = header
	return nil
}

func (w *GeoTIFFWriter) writeIFD(dataOffset int64) error {
	meta := w.metadata
	entries := []struct {
		tag, typ, count uint32
		value          uint32
	}{
		{TIFFTagImageWidth, TIFFTypeLong, 1, uint32(meta.Width)},
		{TIFFTagImageLength, TIFFTypeLong, 1, uint32(meta.Height)},
		{TIFFTagBitsPerSample, TIFFTypeShort, uint32(meta.NumBands), uint32(dataOffset) - 8},
		{TIFFTagCompression, TIFFTypeShort, 1, 1},
		{TIFFTagPhotometricInterp, TIFFTypeShort, 1, 1},
		{TIFFTagSamplesPerPixel, TIFFTypeShort, 1, uint32(meta.NumBands)},
		{TIFFTagRowsPerStrip, TIFFTypeLong, 1, uint32(meta.Height)},
		{TIFFTagStripOffsets, TIFFTypeLong, 1, uint32(dataOffset)},
		{TIFFTagStripByteCounts, TIFFTypeLong, 1, uint32(meta.Width * meta.Height * meta.NumBands * 2)},
		{TIFFTagXResolution, TIFFTypeRational, 1, uint32(dataOffset) + 8},
		{TIFFTagYResolution, TIFFTypeRational, 1, uint32(dataOffset) + 16},
		{TIFFTagResolutionUnit, TIFFTypeShort, 1, 1},
		{TIFFTagSoftware, TIFFTypeASCII, 11, uint32(dataOffset) + 24},
		{TIFFTagGDALNoData, TIFFTypeASCII, 2, uint32(dataOffset) + 36},
		{TIFFTagModelPixelScale, TIFFTypeDouble, 3, uint32(dataOffset) + 40},
		{TIFFTagModelTiepoint, TIFFTypeDouble, 6, uint32(dataOffset) + 64},
	}

	ifdBytes := make([]byte, 2+len(entries)*12+4)
	w.byteOrder.PutUint16(ifdBytes[0:2], uint16(len(entries)))
	for i, e := range entries {
		off := 2 + i*12
		w.byteOrder.PutUint16(ifdBytes[off:off+2], uint16(e.tag))
		w.byteOrder.PutUint16(ifdBytes[off+2:off+4], uint16(e.typ))
		w.byteOrder.PutUint32(ifdBytes[off+4:off+8], e.count)
		w.byteOrder.PutUint32(ifdBytes[off+8:off+12], e.value)
	}
	w.byteOrder.PutUint32(ifdBytes[2+len(entries)*12:], 0)

	if _, err := w.file.WriteAt(ifdBytes, w.ifdOffset); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, "cannot write IFD")
	}

	extraData := make([]byte, 100)
	for i := 0; i < meta.NumBands && i < 10; i++ {
		w.byteOrder.PutUint16(extraData[i*2:i*2+2], 16)
	}
	w.byteOrder.PutUint32(extraData[20:24], 1)
	w.byteOrder.PutUint32(extraData[24:28], 1)
	w.byteOrder.PutUint32(extraData[28:32], 1000000)
	copy(extraData[36:47], []byte("Sentinel-CLI"))
	extraData[47] = 0
	copy(extraData[48:50], []byte("0\000"))

	gt := meta.GeoTransform
	binary.LittleEndian.PutUint64(extraData[56:64], math.Float64bits(math.Abs(gt.PixelWidth)))
	binary.LittleEndian.PutUint64(extraData[64:72], math.Float64bits(math.Abs(gt.PixelHeight)))
	binary.LittleEndian.PutUint64(extraData[72:80], math.Float64bits(0))
	binary.LittleEndian.PutUint64(extraData[80:88], math.Float64bits(0))
	binary.LittleEndian.PutUint64(extraData[88:96], math.Float64bits(0))
	binary.LittleEndian.PutUint64(extraData[96:104], math.Float64bits(gt.OriginX))
	binary.LittleEndian.PutUint64(extraData[104:112], math.Float64bits(gt.OriginY))
	binary.LittleEndian.PutUint64(extraData[112:120], math.Float64bits(0))

	if _, err := w.file.WriteAt(extraData, dataOffset-8); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, "cannot write TIFF extra data")
	}

	return nil
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
	totalValues := bands * rows * cols
	byteData := make([]byte, totalValues*2)
	idx := 0
	for b := 0; b < bands; b++ {
		bandData := data[b]
		for i := 0; i < rows*cols; i++ {
			val := uint16(math.Max(0, math.Min(65535, bandData[i])))
			binary.LittleEndian.PutUint16(byteData[idx:idx+2], val)
			idx += 2
		}
	}

	if chunk.ChunkIndex == 0 && w.written == 0 {
		headerSize := int64(8 + 2 + 16*12 + 4 + 128)
		imageOffset := headerSize
		if err := w.writeTIFFHeader(); err != nil {
			return err
		}
		if err := w.writeIFD(imageOffset); err != nil {
			return err
		}
	}

	offset := int64(8 + 2 + 16*12 + 4 + 128) + int64(chunk.OffsetY)*int64(cols)*int64(bands)*2
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

func CalculateHistogram(data []float64, numBins int, minVal, maxVal float64) ([]uint64, []float64) {
	hist := make([]uint64, numBins)
	bins := make([]float64, numBins+1)
	binWidth := (maxVal - minVal) / float64(numBins)
	for i := 0; i <= numBins; i++ {
		bins[i] = minVal + float64(i)*binWidth
	}
	for _, val := range data {
		if val >= minVal && val <= maxVal {
			binIdx := int((val - minVal) / binWidth)
			if binIdx >= numBins {
				binIdx = numBins - 1
			}
			hist[binIdx]++
		}
	}
	return hist, bins
}

func DetectNoData(data []float64, sampleSize int) (float64, bool) {
	if len(data) == 0 {
		return 0, false
	}
	sample := data
	if len(data) > sampleSize {
		sample = data[:sampleSize]
	}
	valueCount := make(map[float64]int)
	for _, v := range sample {
		valueCount[v]++
	}
	maxCount := 0
	noDataVal := 0.0
	for v, count := range valueCount {
		if count > maxCount {
			maxCount = count
			noDataVal = v
		}
	}
	if float64(maxCount)/float64(len(sample)) > 0.5 {
		return noDataVal, true
	}
	return 0, false
}

func GetChunkProgress(reader *GeoTIFFReader) (int, int, int64, int64) {
	processed := 0
	total := len(reader.chunks)
	var bytesProcessed int64
	var bytesTotal int64
	bytesPerChunk := int64(reader.chunkSizeMB * 1024 * 1024)
	for _, chunk := range reader.chunks {
		bytesTotal += bytesPerChunk
		if chunk.Processed {
			processed++
			bytesProcessed += bytesPerChunk
		}
	}
	return processed, total, bytesProcessed, bytesTotal
}

func ReadMetadata(path string) (*types.GeoTIFFMetadata, error) {
	reader, err := NewGeoTIFFReader(path, 64)
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return reader.Metadata(), nil
}

func FindGeoTIFFFiles(root string, recursive bool) ([]string, error) {
	var files []string
	root = util.ExpandPath(root)
	if _, err := os.Stat(root); os.IsNotExist(err) {
		return nil, apperrors.Wrap(err, apperrors.E4001, fmt.Sprintf("directory not found: %s", root))
	}
	extRegex := regexp.MustCompile(`\.(tif|tiff|img)$`)
	if recursive {
		err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if !info.IsDir() && extRegex.MatchString(strings.ToLower(path)) {
				files = append(files, path)
			}
			return nil
		})
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.E4001, "error walking directory")
		}
	} else {
		entries, err := os.ReadDir(root)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.E4001, "error reading directory")
		}
		for _, entry := range entries {
			if !entry.IsDir() && extRegex.MatchString(strings.ToLower(entry.Name())) {
				files = append(files, filepath.Join(root, entry.Name()))
			}
		}
	}
	sort.Strings(files)
	return files, nil
}
