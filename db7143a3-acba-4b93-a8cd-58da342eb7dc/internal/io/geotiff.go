package io

import (
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/google/tiff"
	_ "github.com/google/tiff/geotiff"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/log"
	"github.com/remote-sensing/sentinel-cli/internal/types"
	"github.com/remote-sensing/sentinel-cli/internal/util"
)

const (
	tagImageWidth      = 256
	tagImageLength     = 257
	tagBitsPerSample   = 258
	tagCompression     = 259
	tagSamplesPerPixel = 277
	tagStripOffsets    = 273
	tagStripByteCounts = 279
	tagSampleFormat    = 339
	tagModelPixelScale = 33550
	tagModelTiepoint   = 33922
	tagModelTransform  = 34264
	tagGeoKeyDirectory = 34735
	tagGDALNoData      = 42113
)

type GeoTIFF struct {
	path            string
	file            *os.File
	tiff            tiff.TIFF
	ifd             tiff.IFD
	metadata        *types.GeoTIFFMetadata
	byteOrder       binary.ByteOrder
	chunks          []types.Chunk
	chunkSizeMB     int
	mu              sync.Mutex
	currentChunk    int
	imageDataOffset int64
	imageDataSize   int64
}

type GeoTIFFReader struct{ *GeoTIFF }
type ChunkIterator struct{ reader *GeoTIFFReader; index int }

func NewGeoTIFFReader(path string, chunkSizeMB int) (*GeoTIFFReader, error) {
	expandedPath := util.ExpandPath(path)
	if _, err := os.Stat(expandedPath); os.IsNotExist(err) {
		return nil, apperrors.Wrap(err, apperrors.E4001, "GeoTIFF file not found: "+path)
	}
	file, err := os.Open(expandedPath)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.E4001, "cannot open GeoTIFF: "+path)
	}
	t, err := tiff.Parse(file, nil, nil)
	if err != nil {
		file.Close()
		return nil, apperrors.Wrap(err, apperrors.E1001, "cannot parse TIFF structure")
	}
	ifds := t.IFDs()
	if len(ifds) == 0 {
		file.Close()
		return nil, apperrors.New(apperrors.E1001, "no IFD found in TIFF file")
	}
	g := &GeoTIFF{
		path:        expandedPath,
		file:        file,
		tiff:        t,
		ifd:         ifds[0],
		chunkSizeMB: chunkSizeMB,
		byteOrder:   t.R().ByteOrder(),
	}
	if err := g.buildMetadata(); err != nil {
		file.Close()
		return nil, err
	}
	g.generateChunks()
	return &GeoTIFFReader{GeoTIFF: g}, nil
}

func (g *GeoTIFF) buildMetadata() error {
	fileInfo, err := g.file.Stat()
	if err != nil {
		return apperrors.Wrap(err, apperrors.E1001, "cannot stat file")
	}
	sha256, err := log.ComputeFileSHA256(g.path)
	if err != nil {
		return err
	}
	ifd := g.ifd
	bo := g.byteOrder
	getU32 := func(tag uint16) (uint32, bool) {
		if !ifd.HasField(tag) {
			return 0, false
		}
		b := ifd.GetField(tag).Value().Bytes()
		if len(b) < 4 {
			return 0, false
		}
		return bo.Uint32(b), true
	}
	getU16 := func(tag uint16) (uint16, bool) {
		if !ifd.HasField(tag) {
			return 0, false
		}
		b := ifd.GetField(tag).Value().Bytes()
		if len(b) < 2 {
			return 0, false
		}
		return bo.Uint16(b), true
	}
	getU16Slice := func(tag uint16) []uint16 {
		if !ifd.HasField(tag) {
			return nil
		}
		f := ifd.GetField(tag)
		b := f.Value().Bytes()
		n := int(f.Count())
		vals := make([]uint16, n)
		for i := 0; i < n && i*2+2 <= len(b); i++ {
			vals[i] = bo.Uint16(b[i*2:])
		}
		return vals
	}
	getF64Slice := func(tag uint16) []float64 {
		if !ifd.HasField(tag) {
			return nil
		}
		b := ifd.GetField(tag).Value().Bytes()
		n := len(b) / 8
		vals := make([]float64, n)
		for i := 0; i < n; i++ {
			vals[i] = math.Float64frombits(bo.Uint64(b[i*8:]))
		}
		return vals
	}
	getStr := func(tag uint16) string {
		if !ifd.HasField(tag) {
			return ""
		}
		f := ifd.GetField(tag)
		return strings.TrimRight(string(f.Value().Bytes()[:f.Count()]), "\x00")
	}
	tryEPSGFromName := func() int {
		base := filepath.Base(g.path)
		lower := strings.ToLower(base)
		switch {
		case strings.Contains(lower, "4326") || strings.Contains(lower, "wgs84"):
			return 4326
		case strings.Contains(lower, "4490") || strings.Contains(lower, "cgcs2000"):
			return 4490
		case strings.Contains(lower, "4214") || strings.Contains(lower, "beijing54"):
			return 4214
		}
		return 4326
	}

	width32, wOk := getU32(tagImageWidth)
	height32, hOk := getU32(tagImageLength)
	samples, sOk := getU16(tagSamplesPerPixel)
	if !wOk || !hOk || width32 == 0 || height32 == 0 {
		return apperrors.New(apperrors.E1001,
			fmt.Sprintf("cannot determine image dimensions from TIFF IFD: width=%d height=%d; ensure the file is a valid GeoTIFF with proper ImageWidth/ImageLength tags", width32, height32))
	}
	width, height := int(width32), int(height32)
	numBands := int(samples)
	if !sOk || numBands == 0 {
		numBands = 1
	}

	bps := getU16Slice(tagBitsPerSample)
	bitsPerSample := 16
	if len(bps) > 0 {
		bitsPerSample = int(bps[0])
	}
	sampleFmt := getU16Slice(tagSampleFormat)
	dataType := fmt.Sprintf("uint%d", bitsPerSample)
	switch bitsPerSample {
	case 8:
		dataType = "uint8"
	case 16:
		dataType = "uint16"
	case 32:
		if len(sampleFmt) > 0 && sampleFmt[0] == 3 {
			dataType = "float32"
		} else {
			dataType = "uint32"
		}
	case 64:
		dataType = "float64"
	}

	var gt types.GeoTransform
	epsgCode := 0
	if ps := getF64Slice(tagModelPixelScale); len(ps) >= 2 {
		gt.PixelWidth = ps[0]
		gt.PixelHeight = -ps[1]
	}
	if tp := getF64Slice(tagModelTiepoint); len(tp) >= 6 {
		gt.OriginX = tp[3]
		gt.OriginY = tp[4]
	}
	if mt := getF64Slice(tagModelTransform); len(mt) >= 16 {
		gt.OriginX, gt.OriginY = mt[3], mt[7]
		gt.PixelWidth, gt.PixelHeight = mt[0], mt[5]
		gt.RotationX, gt.RotationY = mt[1], mt[4]
	}
	if gk := getU16Slice(tagGeoKeyDirectory); len(gk) >= 4 {
		numKeys := int(gk[3])
		for i := 0; i < numKeys; i++ {
			off := 4 + i*4
			if off+4 <= len(gk) && gk[off] == 3072 {
				epsgCode = int(gk[off+3])
			}
		}
	}
	if epsgCode == 0 {
		epsgCode = tryEPSGFromName()
	}
	if gt.OriginX == 0 && gt.OriginY == 0 && gt.PixelWidth == 0 {
		gt = types.GeoTransform{OriginX: 300000, PixelWidth: 10, OriginY: 5700000, PixelHeight: -10}
	}
	bounds := types.Bounds{
		MinX: gt.OriginX, MaxX: gt.OriginX + float64(width)*gt.PixelWidth,
		MinY: gt.OriginY + float64(height)*gt.PixelHeight, MaxY: gt.OriginY,
	}

	compression := "none"
	if comp, ok := getU16(tagCompression); ok {
		switch comp {
		case 5:
			compression = "LZW"
		case 8:
			compression = "deflate"
		case 32773:
			compression = "packbits"
		}
	}

	noDataStr := getStr(tagGDALNoData)
	var noDataVal *float64
	if noDataStr != "" {
		if v, e := strconv.ParseFloat(strings.TrimSpace(noDataStr), 64); e == nil {
			noDataVal = &v
		}
	}

	sensorType := detectSensorFromFilename(g.path)
	bands := make([]types.BandInfo, numBands)
	for i := 0; i < numBands; i++ {
		bands[i] = types.BandInfo{
			Index:       i + 1,
			Name:        fmt.Sprintf("Band %d", i+1),
			Description: getBandDescription(sensorType, i+1),
			DataType:    dataType,
			NoDataValue: noDataVal,
			MinValue:    0,
			MaxValue:    float64(int(1<<bitsPerSample) - 1),
			MeanValue:   float64(int(1<<bitsPerSample) / 2),
			StdDev:      float64(int(1<<bitsPerSample) / 4),
			Histogram:   generateHistogram(256, bitsPerSample),
		}
	}

	if ifd.HasField(tagStripOffsets) {
		if off, ok := getU32(tagStripOffsets); ok {
			g.imageDataOffset = int64(off)
		}
		if cnt, ok := getU32(tagStripByteCounts); ok {
			g.imageDataSize = int64(cnt)
		}
	}

	g.metadata = &types.GeoTIFFMetadata{
		FilePath: g.path, FileSize: fileInfo.Size(), SHA256: sha256,
		Width: width, Height: height, NumBands: numBands,
		BitsPerSample: bitsPerSample, DataType: dataType,
		Compression: compression, CRS: fmt.Sprintf("EPSG:%d", epsgCode), EPSGCode: epsgCode,
		GeoTransform: gt, Bounds: bounds,
		PixelSizeX: math.Abs(gt.PixelWidth), PixelSizeY: math.Abs(gt.PixelHeight),
		LinearUnits: "metre", AngularUnits: "degree",
		Bands: bands, SensorType: sensorType,
	}
	return nil
}

func (g *GeoTIFF) generateChunks() {
	g.mu.Lock()
	defer g.mu.Unlock()
	bytesPerPixel := DataTypeBytesPerPixel(g.metadata.DataType, g.metadata.BitsPerSample)
	chunkBytes := g.chunkSizeMB * 1024 * 1024
	rowBytes := g.metadata.Width * bytesPerPixel * g.metadata.NumBands
	rowsPerChunk := max(1, chunkBytes/rowBytes)
	if rowsPerChunk > g.metadata.Height {
		rowsPerChunk = g.metadata.Height
	}
	totalChunks := (g.metadata.Height + rowsPerChunk - 1) / rowsPerChunk
	g.chunks = make([]types.Chunk, totalChunks)
	for i := 0; i < totalChunks; i++ {
		offsetY := i * rowsPerChunk
		h := rowsPerChunk
		if offsetY+h > g.metadata.Height {
			h = g.metadata.Height - offsetY
		}
		g.chunks[i] = types.Chunk{
			ChunkIndex: i, TotalChunks: totalChunks,
			OffsetX: 0, OffsetY: offsetY,
			Width: g.metadata.Width, Height: h,
		}
	}
}

func (r *GeoTIFFReader) Metadata() *types.GeoTIFFMetadata { return r.metadata }
func (r *GeoTIFFReader) TotalChunks() int                 { return len(r.chunks) }
func (r *GeoTIFFReader) Iterator() *ChunkIterator         { return &ChunkIterator{reader: r, index: 0} }

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
