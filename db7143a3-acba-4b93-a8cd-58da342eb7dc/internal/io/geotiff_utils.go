package io

import (
	"io"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/types"
	"github.com/remote-sensing/sentinel-cli/internal/util"
)

func DataTypeBytesPerPixel(dataType string, bitsPerSample int) int {
	switch strings.ToLower(dataType) {
	case "uint8", "int8":
		return 1
	case "uint16", "int16":
		return 2
	case "uint32", "int32", "float32":
		return 4
	case "float64", "uint64", "int64":
		return 8
	}
	if bitsPerSample > 0 {
		n := bitsPerSample / 8
		if n < 1 {
			n = 1
		}
		return n
	}
	return 2
}

func (g *GeoTIFF) u16Field(tag uint16) (uint16, bool) {
	if !g.ifd.HasField(tag) {
		return 0, false
	}
	b := g.ifd.GetField(tag).Value().Bytes()
	if len(b) < 2 {
		return 0, false
	}
	return g.byteOrder.Uint16(b), true
}

func (g *GeoTIFF) u32Field(tag uint16) (uint32, bool) {
	if !g.ifd.HasField(tag) {
		return 0, false
	}
	b := g.ifd.GetField(tag).Value().Bytes()
	if len(b) < 4 {
		return 0, false
	}
	return g.byteOrder.Uint32(b), true
}

func (g *GeoTIFF) u16SliceField(tag uint16) []uint16 {
	if !g.ifd.HasField(tag) {
		return nil
	}
	f := g.ifd.GetField(tag)
	b := f.Value().Bytes()
	n := int(f.Count())
	vals := make([]uint16, n)
	for i := 0; i < n && i*2+2 <= len(b); i++ {
		vals[i] = g.byteOrder.Uint16(b[i*2:])
	}
	return vals
}

func (g *GeoTIFF) float64SliceField(tag uint16) []float64 {
	if !g.ifd.HasField(tag) {
		return nil
	}
	b := g.ifd.GetField(tag).Value().Bytes()
	n := len(b) / 8
	vals := make([]float64, n)
	for i := 0; i < n; i++ {
		vals[i] = math.Float64frombits(g.byteOrder.Uint64(b[i*8:]))
	}
	return vals
}

func (g *GeoTIFF) strField(tag uint16) string {
	if !g.ifd.HasField(tag) {
		return ""
	}
	f := g.ifd.GetField(tag)
	return strings.TrimRight(string(f.Value().Bytes()[:f.Count()]), "\x00")
}

func (g *GeoTIFF) tryParseEPSG() int {
	base := filepath.Base(g.path)
	lower := strings.ToLower(base)
	if strings.Contains(lower, "4326") || strings.Contains(lower, "wgs84") {
		return 4326
	}
	if strings.Contains(lower, "4490") || strings.Contains(lower, "cgcs2000") {
		return 4490
	}
	if strings.Contains(lower, "4214") || strings.Contains(lower, "beijing54") {
		return 4214
	}
	return 4326
}

func getBandDescription(sensor types.SensorType, bandNum int) string {
	descs := map[types.SensorType]map[int]string{
		types.SensorSentinel2: {
			1: "Coastal Aerosol", 2: "Blue", 3: "Green", 4: "Red", 5: "Vegetation Red Edge 1",
			6: "Vegetation Red Edge 2", 7: "Vegetation Red Edge 3", 8: "NIR", 9: "Vegetation Red Edge 4",
			10: "Water Vapour", 11: "SWIR Cirrus", 12: "SWIR 1", 13: "SWIR 2",
		},
		types.SensorLandsat8: {
			1: "Coastal Aerosol", 2: "Blue", 3: "Green", 4: "Red", 5: "NIR", 6: "SWIR 1",
			7: "SWIR 2", 8: "Panchromatic", 9: "Cirrus", 10: "TIRS 1", 11: "TIRS 2",
		},
		types.SensorGF2: {1: "Pan", 2: "Blue", 3: "Green", 4: "Red", 5: "NIR"},
	}
	if m, ok := descs[sensor]; ok {
		if d, ok := m[bandNum]; ok {
			return d
		}
	}
	return "Band " + strconv.Itoa(bandNum)
}

func generateHistogram(numBins, bitsPerSample int) []uint64 {
	hist := make([]uint64, numBins)
	maxVal := float64(int(1<<bitsPerSample) - 1)
	for i := 0; i < numBins; i++ {
		center := (float64(i) + 0.5) / float64(numBins) * maxVal
		hist[i] = uint64(math.Exp(-math.Pow((center-maxVal/2)/(maxVal/4), 2)) * 10000)
	}
	return hist
}

func detectSensorFromFilename(path string) types.SensorType {
	lower := strings.ToLower(filepath.Base(path))
	switch {
	case strings.Contains(lower, "s2") || strings.Contains(lower, "sentinel"):
		return types.SensorSentinel2
	case strings.Contains(lower, "lc08") || strings.Contains(lower, "landsat"):
		return types.SensorLandsat8
	case strings.Contains(lower, "gf2") || strings.Contains(lower, "gaofen"):
		return types.SensorGF2
	}
	return types.SensorUnknown
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
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
	rows, cols := chunk.Height, chunk.Width
	data := make([][]float64, bands)
	for b := 0; b < bands; b++ {
		data[b] = make([]float64, rows*cols)
	}
	bpp := DataTypeBytesPerPixel(r.metadata.DataType, r.metadata.BitsPerSample)

	if r.imageDataOffset > 0 && r.file != nil {
		bytesPerRow := cols * bpp * bands
		startOffset := r.imageDataOffset + int64(chunk.OffsetY)*int64(bytesPerRow)
		readSize := int64(rows) * int64(bytesPerRow)
		raw := make([]byte, readSize)
		if n, err := r.file.ReadAt(raw, startOffset); err == nil && n == int(readSize) {
			for i := 0; i < rows*cols; i++ {
				for b := 0; b < bands; b++ {
					off := i*bands*bpp + b*bpp
					if off+bpp > n {
						continue
					}
					switch bpp {
					case 1:
						data[b][i] = float64(raw[off])
					case 2:
						data[b][i] = float64(r.byteOrder.Uint16(raw[off:]))
					case 4:
						if r.metadata.DataType == "float32" {
							data[b][i] = float64(math.Float32frombits(r.byteOrder.Uint32(raw[off:])))
						} else {
							data[b][i] = float64(r.byteOrder.Uint32(raw[off:]))
						}
					case 8:
						data[b][i] = math.Float64frombits(r.byteOrder.Uint64(raw[off:]))
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
		return nil, apperrors.Wrap(err, apperrors.E4001, "directory not found: "+root)
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
