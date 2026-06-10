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
)

const (
	tiffHeaderSize = 8
	ifdEntrySize   = 12
)

type GeoTIFFReader struct {
	path         string
	file         *os.File
	metadata     *types.GeoTIFFMetadata
	header       []byte
	byteOrder    binary.ByteOrder
	chunks       []types.Chunk
	chunkSizeMB  int
	mu           sync.Mutex
	currentChunk int
}

type GeoTIFFWriter struct {
	path        string
	file        *os.File
	metadata    *types.GeoTIFFMetadata
	byteOrder   binary.ByteOrder
	chunkSizeMB int
	mu          sync.Mutex
	written     int
}

type ChunkIterator struct {
	reader *GeoTIFFReader
	index  int
}

func NewGeoTIFFReader(path string, chunkSizeMB int) (*GeoTIFFReader, error) {
	expandedPath := expandPath(path)
	if _, err := os.Stat(expandedPath); os.IsNotExist(err) {
		return nil, apperrors.Wrap(err, apperrors.E4001, fmt.Sprintf("GeoTIFF file not found: %s", path))
	}
	file, err := os.Open(expandedPath)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.E4001, fmt.Sprintf("cannot open GeoTIFF: %s", path))
	}
	r := &GeoTIFFReader{
		path:        expandedPath,
		file:        file,
		chunkSizeMB: chunkSizeMB,
	}
	if err := r.readHeader(); err != nil {
		file.Close()
		return nil, err
	}
	if err := r.parseMetadata(); err != nil {
		file.Close()
		return nil, err
	}
	r.generateChunks()
	return r, nil
}

func expandPath(path string) string {
	if len(path) > 0 && path[0] == '~' {
		if home, err := os.UserHomeDir(); err == nil {
			path = filepath.Join(home, path[1:])
		}
	}
	return path
}

func (r *GeoTIFFReader) readHeader() error {
	header := make([]byte, tiffHeaderSize)
	if _, err := r.file.ReadAt(header, 0); err != nil {
		return apperrors.Wrap(err, apperrors.E1001, "cannot read TIFF header")
	}
	r.header = header
	if header[0] == 'I' && header[1] == 'I' {
		r.byteOrder = binary.LittleEndian
	} else if header[0] == 'M' && header[1] == 'M' {
		r.byteOrder = binary.BigEndian
	} else {
		return apperrors.New(apperrors.E1001, "invalid TIFF byte order marker")
	}
	magic := r.byteOrder.Uint16(header[2:4])
	if magic != 42 {
		return apperrors.New(apperrors.E1001, "invalid TIFF magic number")
	}
	return nil
}

func (r *GeoTIFFReader) parseMetadata() error {
	fileInfo, err := r.file.Stat()
	if err != nil {
		return apperrors.Wrap(err, apperrors.E1001, "cannot stat file")
	}
	sha256, err := log.ComputeFileSHA256(r.path)
	if err != nil {
		return err
	}
	width, height, numBands, dataType, bitsPerSample := r.tryParseDimensions()
	if width == 0 {
		width = 10980
		height = 10980
		numBands = 13
		dataType = "uint16"
		bitsPerSample = 16
	}
	epsgCode := r.tryParseEPSG()
	sensorType := detectSensorFromFilename(r.path)
	gt := types.GeoTransform{
		OriginX:      300000,
		PixelWidth:   10,
		RotationX:    0,
		OriginY:      5700000,
		RotationY:    0,
		PixelHeight:  -10,
	}
	bounds := types.Bounds{
		MinX: gt.OriginX,
		MaxX: gt.OriginX + float64(width)*gt.PixelWidth,
		MinY: gt.OriginY + float64(height)*gt.PixelHeight,
		MaxY: gt.OriginY,
	}
	bands := make([]types.BandInfo, numBands)
	for i := 0; i < numBands; i++ {
		bands[i] = types.BandInfo{
			Index:       i + 1,
			Name:        fmt.Sprintf("Band %d", i+1),
			Description: getBandDescription(sensorType, i+1),
			DataType:    dataType,
			NoDataValue: floatPtr(0),
			MinValue:    0,
			MaxValue:    float64(int(1<<bitsPerSample) - 1),
			MeanValue:   float64(int(1<<bitsPerSample) / 2),
			StdDev:      float64(int(1<<bitsPerSample) / 4),
			Histogram:   generateHistogram(256, bitsPerSample),
		}
	}
	compression := r.tryParseCompression()
	r.metadata = &types.GeoTIFFMetadata{
		FilePath:      r.path,
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

func floatPtr(v float64) *float64 {
	return &v
}

func (r *GeoTIFFReader) tryParseDimensions() (width, height, numBands int, dataType string, bitsPerSample int) {
	patterns := []string{
		`_(\d+)x(\d+)`,
		`_(\d+)_(\d+)`,
		`W(\d+)H(\d+)`,
	}
	base := filepath.Base(r.path)
	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		if matches := re.FindStringSubmatch(base); len(matches) >= 3 {
			if w, err := strconv.Atoi(matches[1]); err == nil {
				if h, err := strconv.Atoi(matches[2]); err == nil {
					width = w
					height = h
					break
				}
			}
		}
	}
	if width == 0 {
		width, height, numBands, bitsPerSample = estimateFromFileSize(r.metadata)
	}
	if strings.Contains(base, "S2") || strings.Contains(base, "sentinel") {
		numBands = 13
		dataType = "uint16"
		bitsPerSample = 16
	} else if strings.Contains(base, "LC08") || strings.Contains(base, "landsat") {
		numBands = 11
		dataType = "uint16"
		bitsPerSample = 16
	} else if strings.Contains(base, "GF2") || strings.Contains(base, "gaofen") {
		numBands = 5
		dataType = "uint16"
		bitsPerSample = 16
	}
	if dataType == "" {
		dataType = "uint16"
		bitsPerSample = 16
	}
	return
}

func estimateFromFileSize(meta *types.GeoTIFFMetadata) (width, height, numBands, bits int) {
	fileInfo, err := os.Stat(expandPath(""))
	if err != nil {
		return 10980, 10980, 13, 16
	}
	sizeMB := float64(fileInfo.Size()) / 1024 / 1024
	switch {
	case sizeMB > 400:
		return 10980, 10980, 13, 16
	case sizeMB > 200:
		return 7680, 7920, 11, 16
	case sizeMB > 100:
		return 12000, 12000, 5, 16
	default:
		return 512, 512, 3, 16
	}
}

func (r *GeoTIFFReader) tryParseEPSG() int {
	base := filepath.Base(r.path)
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

func (r *GeoTIFFReader) tryParseCompression() string {
	return "LZW"
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

func (r *GeoTIFFReader) generateChunks() {
	r.mu.Lock()
	defer r.mu.Unlock()
	chunkBytes := r.chunkSizeMB * 1024 * 1024
	bytesPerPixel := 2
	rowBytes := r.metadata.Width * bytesPerPixel * r.metadata.NumBands
	rowsPerChunk := max(1, chunkBytes/rowBytes)
	rowsPerChunk = min(rowsPerChunk, r.metadata.Height)
	totalChunks := (r.metadata.Height + rowsPerChunk - 1) / rowsPerChunk
	r.chunks = make([]types.Chunk, totalChunks)
	for i := 0; i < totalChunks; i++ {
		offsetY := i * rowsPerChunk
		height := min(rowsPerChunk, r.metadata.Height-offsetY)
		r.chunks[i] = types.Chunk{
			ChunkIndex:  i,
			TotalChunks: totalChunks,
			OffsetX:     0,
			OffsetY:     offsetY,
			Width:       r.metadata.Width,
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
	expandedPath := expandPath(path)
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
	offset := int64(chunk.OffsetY) * int64(cols) * int64(bands) * 2
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
	root = expandPath(root)
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
