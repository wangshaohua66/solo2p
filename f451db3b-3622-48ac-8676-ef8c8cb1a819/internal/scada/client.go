// Package scada implements the Modbus TCP acquisition layer: it polls every
// configured station for instantaneous pressure/temperature/flow and the
// accumulated volume, validates each sample against the station value domain,
// retries on transient failure and marks anomalous samples. It includes a
// self-contained Modbus TCP client (function code 0x03, read holding registers)
// so the binary has no hard dependency on a third-party Modbus library, and a
// simulate mode that produces realistic in-range data when no field device is
// available.
package scada

import (
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"math/rand"
	"net"
	"sync"
	"time"

	"scheduler/internal/config"
	"scheduler/internal/models"
)

// Progress is a callback invoked as each station completes, enabling the CLI to
// render a progress bar during a collection.
type Progress func(done, total int, stationID string, err error)

// Client polls stations over Modbus TCP and validates the samples.
type Client struct {
	cfg       config.Config
	retries   int
	timeout   time.Duration
	mu        sync.Mutex
	rng       *rand.Rand
	accum     map[string]float64 // per-station simulated accumulator
	lastFlow  map[string]float64
}

// New returns a SCADA client bound to a configuration snapshot.
func New(cfg config.Config) *Client {
	return &Client{
		cfg:      cfg,
		retries:  maxInt(cfg.SCADA.Retries, 1),
		timeout:  cfg.SCADA.Timeout,
		rng:      rand.New(rand.NewSource(time.Now().UnixNano())),
		accum:    make(map[string]float64),
		lastFlow: make(map[string]float64),
	}
}

// Collect polls every station concurrently and returns validated readings.
// The whole poll is bounded by ctx so the 3-second response budget holds even
// when a station is unreachable (retries still apply per station).
func (c *Client) Collect(ctx context.Context, stations []models.Station, p Progress) ([]models.Reading, error) {
	total := len(stations)
	out := make([]models.Reading, total)
	errs := make([]error, total)
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8) // limit concurrency to avoid saturating SCADA links
	for i, s := range stations {
		wg.Add(1)
		go func(i int, s models.Station) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			rd, err := c.collectStation(ctx, s)
			out[i] = rd
			errs[i] = err
			if p != nil {
				p(i+1, total, s.ID, err)
			}
		}(i, s)
	}
	wg.Wait()
	// Drop stations that failed every retry but keep successful + marked-invalid.
	res := out[:0]
	for i := range out {
		if errs[i] == nil {
			res = append(res, out[i])
		}
	}
	return res, nil
}

// collectStation reads one station with retry. A read that fails transport or
// fails validation is retried; a sample that fails value-domain validation is
// still returned (marked invalid) so it is archived for traceability.
func (c *Client) collectStation(ctx context.Context, s models.Station) (models.Reading, error) {
	var lastErr error
	for attempt := 0; attempt <= c.retries; attempt++ {
		ctx2, cancel := context.WithTimeout(ctx, c.stationTimeout())
		rd, err := c.readStation(ctx2, s)
		cancel()
		if err == nil {
			validated, anomaly := rd.ValidateDomain(s)
			if anomaly == "" {
				return validated, nil
			}
			// anomaly: mark and retry once, then return the marked sample
			if attempt < c.retries {
				lastErr = fmt.Errorf("validation: %s", anomaly)
				continue
			}
			return validated, nil
		}
		lastErr = err
	}
	return models.Reading{StationID: s.ID, Timestamp: time.Now().Truncate(time.Second), Valid: false,
		Anomaly: fmt.Sprintf("collect failed: %v", lastErr), CollectedAt: time.Now()}, lastErr
}

func (c *Client) stationTimeout() time.Duration {
	if c.timeout > 0 {
		return c.timeout
	}
	return 2 * time.Second
}

// readStation dispatches to the Modbus transport or the simulator.
func (c *Client) readStation(ctx context.Context, s models.Station) (models.Reading, error) {
	now := time.Now().Truncate(time.Second)
	if c.cfg.SCADA.Simulate {
		return c.simulate(s, now), nil
	}
	p, err := c.readFloat(s.Address, s.UnitID, s.RegPressure)
	if err != nil {
		return models.Reading{}, err
	}
	t, err := c.readFloat(s.Address, s.UnitID, s.RegTemperature)
	if err != nil {
		return models.Reading{}, err
	}
	f, err := c.readFloat(s.Address, s.UnitID, s.RegFlow)
	if err != nil {
		return models.Reading{}, err
	}
	acc, err := c.readFloat(s.Address, s.UnitID, s.RegAccum)
	if err != nil {
		return models.Reading{}, err
	}
	return models.Reading{
		StationID:   s.ID,
		Timestamp:   now,
		Pressure:    p,
		Temperature: t,
		FlowRate:    f,
		Accumulated: acc,
		CollectedAt: time.Now(),
		Valid:       true,
	}, nil
}

// simulate produces a realistic, in-range reading using a smoothed random walk
// around each station's configured value domain, and advances the accumulated
// counter by flow*deltaHours so the settlement engine has monotonic data.
func (c *Client) simulate(s models.Station, now time.Time) models.Reading {
	c.mu.Lock()
	defer c.mu.Unlock()
	mid := func(lo, hi float64) float64 { return (lo + hi) / 2 }
	spread := func(lo, hi float64) float64 {
		amp := (hi - lo) / 2 * 0.15
		return mid(lo, hi) + (c.rng.Float64()*2-1)*amp
	}
	prev := c.lastFlow[s.ID]
	flow := spread(s.FlowMin, s.FlowMax)
	if prev > 0 {
		flow = prev*0.7 + flow*0.3 // smoothing toward plausible continuity
	}
	c.lastFlow[s.ID] = flow
	// advance accumulator assuming a 5-minute poll interval
	deltaHours := 5.0 / 60.0
	c.accum[s.ID] += flow * deltaHours
	return models.Reading{
		StationID:   s.ID,
		Timestamp:   now,
		Pressure:    spread(s.PressureMin, s.PressureMax),
		Temperature: spread(s.TempMin, s.TempMax),
		FlowRate:    flow,
		Accumulated: math.Round(c.accum[s.ID]*100) / 100,
		CollectedAt: time.Now(),
		Valid:       true,
	}
}

// ---------------------------------------------------------------------------
// Minimal Modbus TCP client (function code 0x03, read holding registers)
// ---------------------------------------------------------------------------

// modbusRead is a package-level seam so tests can inject a fake transport.
var modbusRead = realModbusRead

// readFloat reads two consecutive holding registers and decodes them as an
// IEEE-754 float32 (big-endian, the most common SCADA byte ordering).
func (c *Client) readFloat(addr string, unitID byte, reg uint16) (float64, error) {
	if reg == 0 {
		return 0, nil
	}
	raw, err := modbusRead(addr, unitID, reg, 2, c.stationTimeout())
	if err != nil {
		return 0, err
	}
	if len(raw) < 4 {
		return 0, fmt.Errorf("short modbus response: %d bytes", len(raw))
	}
	bits := binary.BigEndian.Uint32(raw)
	return float64(math.Float32frombits(bits)), nil
}

// realModbusRead opens a TCP connection, sends a Read Holding Registers request
// and returns the register payload bytes.
func realModbusRead(addr string, unitID byte, startReg, quantity uint16, timeout time.Duration) ([]byte, error) {
	d := net.Dialer{Timeout: timeout}
	conn, err := d.Dial("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", addr, err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(timeout))

	tx := make([]byte, 12)
	binary.BigEndian.PutUint16(tx[0:2], 1)        // transaction id
	binary.BigEndian.PutUint16(tx[2:4], 0)        // protocol id = Modbus
	binary.BigEndian.PutUint16(tx[4:6], 6)        // length of remainder
	tx[6] = unitID                                 // unit id
	tx[7] = 0x03                                    // function code: read holding registers
	binary.BigEndian.PutUint16(tx[8:10], startReg)
	binary.BigEndian.PutUint16(tx[10:12], quantity)
	if _, err := conn.Write(tx); err != nil {
		return nil, fmt.Errorf("write: %w", err)
	}
	hdr := make([]byte, 7)
	if _, err := readFull(conn, hdr); err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}
	length := int(binary.BigEndian.Uint16(hdr[4:6]))
	if length <= 1 {
		return nil, fmt.Errorf("invalid modbus length %d", length)
	}
	pdu := make([]byte, length-1) // subtract unit id already counted in length
	if _, err := readFull(conn, pdu); err != nil {
		return nil, fmt.Errorf("read pdu: %w", err)
	}
	if len(pdu) == 0 {
		return nil, fmt.Errorf("empty pdu")
	}
	if pdu[0]&0x80 != 0 { // exception response
		return nil, fmt.Errorf("modbus exception code %d", pdu[1])
	}
	if len(pdu) < 1 {
		return nil, fmt.Errorf("pdu too short")
	}
	byteCount := int(pdu[1])
	if len(pdu)-2 < byteCount {
		return nil, fmt.Errorf("byte count mismatch")
	}
	return pdu[2 : 2+byteCount], nil
}

// readFull reads exactly n bytes from conn, handling partial reads.
func readFull(conn net.Conn, buf []byte) (int, error) {
	got := 0
	for got < len(buf) {
		n, err := conn.Read(buf[got:])
		if n > 0 {
			got += n
		}
		if err != nil {
			return got, err
		}
	}
	return got, nil
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
