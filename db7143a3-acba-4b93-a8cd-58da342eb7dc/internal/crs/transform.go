package crs

import (
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"sync"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/types"
	"github.com/remote-sensing/sentinel-cli/internal/util"
)

const (
	degToRad = math.Pi / 180.0
	radToDeg = 180.0 / math.Pi
)

type CRSTransformer struct {
	config      types.CRSTransformConfig
	ntv2Grid    *NTv2GridData
	params      types.SevenParams
	initialized bool
	mu          sync.Mutex
}

type NTv2GridData struct {
	numSubGrids int
	subGrids    []SubGrid
	numRecords  int
}

type SubGrid struct {
	name         string
	parentName   string
	llLat        float64
	llLon        float64
	urLat        float64
	urLon        float64
	latInterval  float64
	lonInterval  float64
	numLatNodes  int
	numLonNodes  int
	shifts       []ShiftRecord
}

type ShiftRecord struct {
	latShift float64
	lonShift float64
	latAcc   float64
	lonAcc   float64
}

type Coordinate struct {
	Latitude  float64
	Longitude float64
	Height    float64
}

func NewCRSTransformer(config types.CRSTransformConfig) (*CRSTransformer, error) {
	if !isValidEPSG(config.SourceEPSG) {
		return nil, apperrors.New(apperrors.E2001, fmt.Sprintf("invalid source EPSG code: %d", config.SourceEPSG))
	}
	if !isValidEPSG(config.TargetEPSG) {
		return nil, apperrors.New(apperrors.E2001, fmt.Sprintf("invalid target EPSG code: %d", config.TargetEPSG))
	}
	t := &CRSTransformer{
		config: config,
	}
	if config.SevenParams != nil {
		if err := validateSevenParams(*config.SevenParams); err != nil {
			return nil, err
		}
		t.params = *config.SevenParams
	}
	if config.NTv2Grid != nil {
		if err := t.loadNTv2Grid(config.NTv2Grid.FilePath); err != nil {
			return nil, err
		}
	}
	if config.SevenParams == nil && config.NTv2Grid == nil {
		t.params = getDefaultParams(config.SourceEPSG, config.TargetEPSG)
	}
	t.initialized = true
	return t, nil
}

func isValidEPSG(code int) bool {
	validCodes := map[int]bool{
		4326: true, 4490: true, 4214: true, 4610: true,
		3857: true, 32649: true, 32650: true, 32651: true,
		23849: true, 23850: true,
	}
	return validCodes[code]
}

func validateSevenParams(params types.SevenParams) error {
	if math.Abs(params.DX) > 10000 || math.Abs(params.DY) > 10000 || math.Abs(params.DZ) > 10000 {
		return apperrors.New(apperrors.E2003, "translation parameters must be between -10000 and 10000 meters")
	}
	if math.Abs(params.RX) > 10 || math.Abs(params.RY) > 10 || math.Abs(params.RZ) > 10 {
		return apperrors.New(apperrors.E2003, "rotation parameters must be between -10 and 10 arc-seconds")
	}
	if math.Abs(params.DS) > 100 {
		return apperrors.New(apperrors.E2003, "scale parameter must be between -100 and 100 ppm")
	}
	return nil
}

func getDefaultParams(sourceEPSG, targetEPSG int) types.SevenParams {
	key := fmt.Sprintf("%d_to_%d", sourceEPSG, targetEPSG)
	paramsMap := map[string]types.SevenParams{
		"4326_to_4490":  {DX: -26.7, DY: 69.5, DZ: 33.9, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
		"4490_to_4326":  {DX: 26.7, DY: -69.5, DZ: -33.9, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
		"4326_to_4214":  {DX: -13.5, DY: -129.5, DZ: -76.8, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
		"4214_to_4326":  {DX: 13.5, DY: 129.5, DZ: 76.8, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
		"4326_to_4610":  {DX: -10.5, DY: -118.5, DZ: -63.5, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
		"4610_to_4326":  {DX: 10.5, DY: 118.5, DZ: 63.5, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
		"4214_to_4490":  {DX: 13.5, DY: 129.5, DZ: 76.8, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
		"4490_to_4214":  {DX: -13.5, DY: -129.5, DZ: -76.8, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
		"4610_to_4490":  {DX: 10.5, DY: 118.5, DZ: 63.5, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
		"4490_to_4610":  {DX: -10.5, DY: -118.5, DZ: -63.5, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
		"4214_to_4610":  {DX: 3.0, DY: 11.0, DZ: 13.3, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
		"4610_to_4214":  {DX: -3.0, DY: -11.0, DZ: -13.3, RX: 0.0, RY: 0.0, RZ: 0.0, DS: 0.0},
	}
	if params, ok := paramsMap[key]; ok {
		return params
	}
	return types.SevenParams{DX: 0, DY: 0, DZ: 0, RX: 0, RY: 0, RZ: 0, DS: 0}
}

func (t *CRSTransformer) loadNTv2Grid(filePath string) error {
	expandedPath := util.ExpandPath(filePath)
	if _, err := os.Stat(expandedPath); os.IsNotExist(err) {
		return apperrors.Wrap(err, apperrors.E2004, fmt.Sprintf("NTv2 grid file not found: %s", filePath))
	}
	file, err := os.Open(expandedPath)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E2004, fmt.Sprintf("cannot open NTv2 grid: %s", filePath))
	}
	defer file.Close()
	grid := &NTv2GridData{}
	header := make([]byte, 11 * 4)
	if _, err := file.Read(header); err != nil {
		return apperrors.Wrap(err, apperrors.E2004, "cannot read NTv2 header")
	}
	grid.numSubGrids = int(binary.LittleEndian.Uint32(header[8:12]))
	for i := 0; i < grid.numSubGrids; i++ {
		subHeader := make([]byte, 176)
		if _, err := file.Read(subHeader); err != nil {
			return apperrors.Wrap(err, apperrors.E2004, "cannot read subgrid header")
		}
		sg := SubGrid{
			name:        string(subHeader[0:8]),
			parentName:  string(subHeader[8:16]),
			llLat:       math.Float64frombits(binary.LittleEndian.Uint64(subHeader[16:24])),
			llLon:       math.Float64frombits(binary.LittleEndian.Uint64(subHeader[24:32])),
			urLat:       math.Float64frombits(binary.LittleEndian.Uint64(subHeader[32:40])),
			urLon:       math.Float64frombits(binary.LittleEndian.Uint64(subHeader[40:48])),
			latInterval: math.Float64frombits(binary.LittleEndian.Uint64(subHeader[48:56])),
			lonInterval: math.Float64frombits(binary.LittleEndian.Uint64(subHeader[56:64])),
			numLatNodes: int(binary.LittleEndian.Uint32(subHeader[64:68])),
			numLonNodes: int(binary.LittleEndian.Uint32(subHeader[68:72])),
		}
		numRecords := sg.numLatNodes * sg.numLonNodes
		recordSize := 16
		records := make([]byte, numRecords*recordSize)
		if _, err := file.Read(records); err != nil {
			return apperrors.Wrap(err, apperrors.E2004, "cannot read grid records")
		}
		for j := 0; j < numRecords; j++ {
			offset := j * recordSize
			sg.shifts = append(sg.shifts, ShiftRecord{
				latShift: math.Float64frombits(binary.LittleEndian.Uint64(records[offset : offset+8])),
				lonShift: math.Float64frombits(binary.LittleEndian.Uint64(records[offset+8 : offset+16])),
			})
		}
		grid.subGrids = append(grid.subGrids, sg)
	}
	t.ntv2Grid = grid
	return nil
}

func (t *CRSTransformer) Transform(coord Coordinate) (Coordinate, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if !t.initialized {
		return Coordinate{}, apperrors.New(apperrors.E2002, "transformer not initialized")
	}
	sourceInfo := getDatumInfo(t.config.SourceEPSG)
	targetInfo := getDatumInfo(t.config.TargetEPSG)
	if sourceInfo.epsg == targetInfo.epsg {
		return coord, nil
	}
	if !t.isInBounds(coord, sourceInfo) {
		return Coordinate{}, apperrors.New(apperrors.E2005,
			fmt.Sprintf("coordinate (%.6f, %.6f) is out of bounds for EPSG:%d",
				coord.Latitude, coord.Longitude, t.config.SourceEPSG))
	}
	if t.ntv2Grid != nil {
		return t.transformNTv2(coord, sourceInfo, targetInfo)
	}
	return t.transformBursaWolf(coord, sourceInfo, targetInfo)
}

func (t *CRSTransformer) isInBounds(coord Coordinate, datum DatumInfo) bool {
	if coord.Latitude < datum.minLat || coord.Latitude > datum.maxLat {
		return false
	}
	if coord.Longitude < datum.minLon || coord.Longitude > datum.maxLon {
		return false
	}
	return true
}

type DatumInfo struct {
	epsg   int
	name   string
	ellipsoid Ellipsoid
	minLat float64
	maxLat float64
	minLon float64
	maxLon float64
}

type Ellipsoid struct {
	a    float64
	f    float64
	invF float64
	e2   float64
}

var wgs84Ellipsoid = Ellipsoid{a: 6378137.0, f: 1.0 / 298.257223563, invF: 298.257223563}
var cgcs2000Ellipsoid = Ellipsoid{a: 6378137.0, f: 1.0 / 298.257222101, invF: 298.257222101}
var beijing54Ellipsoid = Ellipsoid{a: 6378245.0, f: 1.0 / 298.3, invF: 298.3}
var xian80Ellipsoid = Ellipsoid{a: 6378140.0, f: 1.0 / 298.257, invF: 298.257}

func init() {
	wgs84Ellipsoid.e2 = 1 - (1-wgs84Ellipsoid.f)*(1-wgs84Ellipsoid.f)
	cgcs2000Ellipsoid.e2 = 1 - (1-cgcs2000Ellipsoid.f)*(1-cgcs2000Ellipsoid.f)
	beijing54Ellipsoid.e2 = 1 - (1-beijing54Ellipsoid.f)*(1-beijing54Ellipsoid.f)
	xian80Ellipsoid.e2 = 1 - (1-xian80Ellipsoid.f)*(1-xian80Ellipsoid.f)
}

func getDatumInfo(epsg int) DatumInfo {
	switch epsg {
	case 4326:
		return DatumInfo{
			epsg:      4326,
			name:      "WGS84",
			ellipsoid: wgs84Ellipsoid,
			minLat:    -90, maxLat: 90,
			minLon: -180, maxLon: 180,
		}
	case 4490:
		return DatumInfo{
			epsg:      4490,
			name:      "CGCS2000",
			ellipsoid: cgcs2000Ellipsoid,
			minLat:    18, maxLat: 54,
			minLon: 73, maxLon: 136,
		}
	case 4214:
		return DatumInfo{
			epsg:      4214,
			name:      "Beijing54",
			ellipsoid: beijing54Ellipsoid,
			minLat:    18, maxLat: 54,
			minLon: 73, maxLon: 136,
		}
	case 4610:
		return DatumInfo{
			epsg:      4610,
			name:      "Xian80",
			ellipsoid: xian80Ellipsoid,
			minLat:    18, maxLat: 54,
			minLon: 73, maxLon: 136,
		}
	default:
		return DatumInfo{
			epsg:      epsg,
			name:      "Unknown",
			ellipsoid: wgs84Ellipsoid,
			minLat:    -90, maxLat: 90,
			minLon: -180, maxLon: 180,
		}
	}
}

func (t *CRSTransformer) transformBursaWolf(coord Coordinate, source, target DatumInfo) (Coordinate, error) {
	sourceEcef := geodeticToECEF(coord, source.ellipsoid)
	rotated := applyBursaWolf(sourceEcef, t.params)
	result := ecefToGeodetic(rotated, target.ellipsoid)
	return result, nil
}

func geodeticToECEF(coord Coordinate, ell Ellipsoid) Coordinate {
	latRad := coord.Latitude * degToRad
	lonRad := coord.Longitude * degToRad
	sinLat := math.Sin(latRad)
	cosLat := math.Cos(latRad)
	N := ell.a / math.Sqrt(1-ell.e2*sinLat*sinLat)
	x := (N + coord.Height) * cosLat * math.Cos(lonRad)
	y := (N + coord.Height) * cosLat * math.Sin(lonRad)
	z := (N*(1-ell.e2) + coord.Height) * sinLat
	return Coordinate{Latitude: x, Longitude: y, Height: z}
}

func ecefToGeodetic(ecef Coordinate, ell Ellipsoid) Coordinate {
	x := ecef.Latitude
	y := ecef.Longitude
	z := ecef.Height
	p := math.Sqrt(x*x + y*y)
	lon := math.Atan2(y, x)
	lat := math.Atan2(z, p*(1-ell.e2))
	for i := 0; i < 10; i++ {
		sinLat := math.Sin(lat)
		N := ell.a / math.Sqrt(1-ell.e2*sinLat*sinLat)
		h := p/math.Cos(lat) - N
		newLat := math.Atan2(z, p*(1-ell.e2*N/(N+h)))
		if math.Abs(newLat-lat) < 1e-12 {
			lat = newLat
			break
		}
		lat = newLat
	}
	sinLat := math.Sin(lat)
	N := ell.a / math.Sqrt(1-ell.e2*sinLat*sinLat)
	h := p/math.Cos(lat) - N
	return Coordinate{
		Latitude:  lat * radToDeg,
		Longitude: lon * radToDeg,
		Height:    h,
	}
}

func applyBursaWolf(ecef Coordinate, params types.SevenParams) Coordinate {
	arcSecToRad := math.Pi / (180.0 * 3600.0)
	ppmToUnit := 1e-6
	RX := params.RX * arcSecToRad
	RY := params.RY * arcSecToRad
	RZ := params.RZ * arcSecToRad
	S := 1.0 + params.DS*ppmToUnit
	x := ecef.Latitude
	y := ecef.Longitude
	z := ecef.Height
	x2 := S*(x - RZ*y + RY*z) + params.DX
	y2 := S*(RZ*x + y - RX*z) + params.DY
	z2 := S*(-RY*x + RX*y + z) + params.DZ
	return Coordinate{Latitude: x2, Longitude: y2, Height: z2}
}

func (t *CRSTransformer) transformNTv2(coord Coordinate, source, target DatumInfo) (Coordinate, error) {
	if t.ntv2Grid == nil {
		return coord, nil
	}
	sg := t.findSubGrid(coord)
	if sg == nil {
		return t.transformBursaWolf(coord, source, target)
	}
	shift := t.interpolateShift(coord, sg)
	result := Coordinate{
		Latitude:  coord.Latitude + shift.latShift/3600.0,
		Longitude: coord.Longitude + shift.lonShift/3600.0,
		Height:    coord.Height,
	}
	return result, nil
}

func (t *CRSTransformer) findSubGrid(coord Coordinate) *SubGrid {
	var best *SubGrid
	bestArea := math.Inf(1)
	for i := range t.ntv2Grid.subGrids {
		sg := &t.ntv2Grid.subGrids[i]
		if coord.Latitude >= sg.llLat && coord.Latitude <= sg.urLat &&
			coord.Longitude >= sg.llLon && coord.Longitude <= sg.urLon {
			area := (sg.urLat - sg.llLat) * (sg.urLon - sg.llLon)
			if area < bestArea {
				bestArea = area
				best = sg
			}
		}
	}
	return best
}

func (t *CRSTransformer) interpolateShift(coord Coordinate, sg *SubGrid) ShiftRecord {
	latFrac := (coord.Latitude - sg.llLat) / sg.latInterval
	lonFrac := (coord.Longitude - sg.llLon) / sg.lonInterval
	latIdx := int(latFrac)
	lonIdx := int(lonFrac)
	latFrac -= float64(latIdx)
	lonFrac -= float64(lonIdx)
	if latIdx >= sg.numLatNodes-1 {
		latIdx = sg.numLatNodes - 2
		latFrac = 1.0
	}
	if lonIdx >= sg.numLonNodes-1 {
		lonIdx = sg.numLonNodes - 2
		lonFrac = 1.0
	}
	i00 := latIdx*sg.numLonNodes + lonIdx
	i01 := i00 + 1
	i10 := (latIdx+1)*sg.numLonNodes + lonIdx
	i11 := i10 + 1
	s00 := sg.shifts[i00]
	s01 := sg.shifts[i01]
	s10 := sg.shifts[i10]
	s11 := sg.shifts[i11]
	latShift := (1-latFrac)*(1-lonFrac)*s00.latShift +
		latFrac*(1-lonFrac)*s10.latShift +
		(1-latFrac)*lonFrac*s01.latShift +
		latFrac*lonFrac*s11.latShift
	lonShift := (1-latFrac)*(1-lonFrac)*s00.lonShift +
		latFrac*(1-lonFrac)*s10.lonShift +
		(1-latFrac)*lonFrac*s01.lonShift +
		latFrac*lonFrac*s11.lonShift
	return ShiftRecord{
		latShift: latShift,
		lonShift: lonShift,
	}
}

func (t *CRSTransformer) TransformChunk(chunk *types.Chunk, sourceMetadata *types.GeoTIFFMetadata) (*types.Chunk, error) {
	data, ok := chunk.Data.([][]float64)
	if !ok {
		return nil, apperrors.New(apperrors.E2001, "invalid chunk data format")
	}
	sourceEPSG := sourceMetadata.EPSGCode
	targetEPSG := t.config.TargetEPSG
	if sourceEPSG == targetEPSG {
		return chunk, nil
	}
	gt := sourceMetadata.GeoTransform
	rows := chunk.Height
	cols := chunk.Width
	totalPixels := rows * cols

	cornerCoords := []struct{ row, col int }{
		{0, 0},
		{0, cols - 1},
		{rows - 1, 0},
		{rows - 1, cols - 1},
	}
	transformedCorners := make([]Coordinate, 4)
	for i, c := range cornerCoords {
		absRow := chunk.OffsetY + c.row
		absCol := chunk.OffsetX + c.col
		x := gt.OriginX + float64(absCol)*gt.PixelWidth + gt.PixelWidth/2
		y := gt.OriginY + float64(absRow)*gt.PixelHeight + gt.PixelHeight/2
		coord := Coordinate{Latitude: y, Longitude: x}
		transformed, err := t.Transform(coord)
		if err != nil {
			transformedCorners[i] = coord
		} else {
			transformedCorners[i] = transformed
		}
	}

	minX := transformedCorners[0].Longitude
	maxX := transformedCorners[0].Longitude
	minY := transformedCorners[0].Latitude
	maxY := transformedCorners[0].Latitude
	for _, c := range transformedCorners[1:] {
		if c.Longitude < minX { minX = c.Longitude }
		if c.Longitude > maxX { maxX = c.Longitude }
		if c.Latitude < minY { minY = c.Latitude }
		if c.Latitude > maxY { maxY = c.Latitude }
	}

	newGT := types.GeoTransform{
		OriginX:     minX,
		OriginY:     maxY,
		PixelWidth:  (maxX - minX) / float64(cols),
		PixelHeight: (minY - maxY) / float64(rows),
		RotationX:   0,
		RotationY:   0,
	}

	transformedData := make([][]float64, len(data))
	for b := range data {
		transformedData[b] = make([]float64, totalPixels)
	}

	for i := 0; i < totalPixels; i++ {
		row := i / cols
		col := i % cols
		absRow := chunk.OffsetY + row
		absCol := chunk.OffsetX + col
		x := gt.OriginX + float64(absCol)*gt.PixelWidth + gt.PixelWidth/2
		y := gt.OriginY + float64(absRow)*gt.PixelHeight + gt.PixelHeight/2
		coord := Coordinate{Latitude: y, Longitude: x}
		transformed, err := t.Transform(coord)
		if err != nil {
			transformed = coord
		}

		newColFloat := (transformed.Longitude - newGT.OriginX) / newGT.PixelWidth
		newRowFloat := (transformed.Latitude - newGT.OriginY) / newGT.PixelHeight
		newCol := int(math.Max(0, math.Min(float64(cols-1), math.Round(newColFloat))))
		newRow := int(math.Max(0, math.Min(float64(rows-1), math.Round(newRowFloat))))
		newIdx := newRow*cols + newCol

		for b := range data {
			transformedData[b][newIdx] = data[b][i]
		}
	}

	resultChunk := *chunk
	resultChunk.Data = transformedData
	if chunk.GeoTransform == nil {
		chunk.GeoTransform = &types.GeoTransform{}
	}
	*chunk.GeoTransform = newGT
	return &resultChunk, nil
}

func (t *CRSTransformer) TransformGeoTransform(gt types.GeoTransform, width, height int) (types.GeoTransform, types.Bounds, error) {
	corners := []Coordinate{
		{Latitude: gt.OriginY, Longitude: gt.OriginX},
		{Latitude: gt.OriginY, Longitude: gt.OriginX + float64(width)*gt.PixelWidth},
		{Latitude: gt.OriginY + float64(height)*gt.PixelHeight, Longitude: gt.OriginX},
		{Latitude: gt.OriginY + float64(height)*gt.PixelHeight, Longitude: gt.OriginX + float64(width)*gt.PixelWidth},
	}
	transformed := make([]Coordinate, 4)
	var err error
	for i, c := range corners {
		transformed[i], err = t.Transform(c)
		if err != nil {
			return gt, types.Bounds{}, err
		}
	}
	minLat := transformed[0].Latitude
	maxLat := transformed[0].Latitude
	minLon := transformed[0].Longitude
	maxLon := transformed[0].Longitude
	for _, c := range transformed[1:] {
		minLat = math.Min(minLat, c.Latitude)
		maxLat = math.Max(maxLat, c.Latitude)
		minLon = math.Min(minLon, c.Longitude)
		maxLon = math.Max(maxLon, c.Longitude)
	}
	newGT := types.GeoTransform{
		OriginX:     minLon,
		OriginY:     maxLat,
		PixelWidth:  gt.PixelWidth,
		PixelHeight: gt.PixelHeight,
		RotationX:   0,
		RotationY:   0,
	}
	bounds := types.Bounds{
		MinX: minLon,
		MaxX: maxLon,
		MinY: minLat,
		MaxY: maxLat,
	}
	return newGT, bounds, nil
}

func (t *CRSTransformer) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.ntv2Grid = nil
	t.initialized = false
	return nil
}

func ListSupportedEPSG() map[int]string {
	return map[int]string{
		4326:  "WGS84 - World Geodetic System 1984 (Global)",
		4490:  "CGCS2000 - China Geodetic Coordinate System 2000 (China)",
		4214:  "Beijing54 - Beijing Geodetic Coordinate System 1954 (China)",
		4610:  "Xian80 - Xi'an Geodetic Coordinate System 1980 (China)",
		3857:  "Web Mercator / Pseudo-Mercator (Global Web)",
		32649: "WGS 84 / UTM zone 49N (China East)",
		32650: "WGS 84 / UTM zone 50N (China Central)",
		32651: "WGS 84 / UTM zone 51N (China West)",
		23849: "CGCS2000 / 3-degree Gauss-Kruger zone 25",
		23850: "CGCS2000 / 3-degree Gauss-Kruger zone 26",
	}
}

func GetDefaultTransform(sourceEPSG, targetEPSG int) (types.SevenParams, error) {
	if !isValidEPSG(sourceEPSG) {
		return types.SevenParams{}, apperrors.New(apperrors.E2001, fmt.Sprintf("invalid source EPSG: %d", sourceEPSG))
	}
	if !isValidEPSG(targetEPSG) {
		return types.SevenParams{}, apperrors.New(apperrors.E2001, fmt.Sprintf("invalid target EPSG: %d", targetEPSG))
	}
	return getDefaultParams(sourceEPSG, targetEPSG), nil
}
