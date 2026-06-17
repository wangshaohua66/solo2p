package utils

import (
	"math"
	"testing"
	"time"
)

func TestCalculateTATPhase(t *testing.T) {
	receivedAt := time.Date(2024, 1, 1, 8, 0, 0, 0, time.UTC)
	testingAt := time.Date(2024, 1, 1, 9, 30, 0, 0, time.UTC)
	reviewingAt := time.Date(2024, 1, 1, 11, 0, 0, 0, time.UTC)
	completedAt := time.Date(2024, 1, 1, 12, 15, 0, 0, time.UTC)

	phase := CalculateTATPhase(receivedAt, testingAt, reviewingAt, completedAt)

	if phase.ReceiveToTest != 90*time.Minute {
		t.Errorf("ReceiveToTest expected 90 min, got %v", phase.ReceiveToTest.Minutes())
	}
	if phase.TestToReview != 90*time.Minute {
		t.Errorf("TestToReview expected 90 min, got %v", phase.TestToReview.Minutes())
	}
	if phase.ReviewToDone != 75*time.Minute {
		t.Errorf("ReviewToDone expected 75 min, got %v", phase.ReviewToDone.Minutes())
	}
	if phase.Total != 255*time.Minute {
		t.Errorf("Total expected 255 min, got %v", phase.Total.Minutes())
	}
}

func TestCalculateTATPhasePartial(t *testing.T) {
	receivedAt := time.Date(2024, 1, 1, 8, 0, 0, 0, time.UTC)
	testingAt := time.Date(2024, 1, 1, 9, 0, 0, 0, time.UTC)
	var zeroTime time.Time

	phase := CalculateTATPhase(receivedAt, testingAt, zeroTime, zeroTime)

	if phase.ReceiveToTest != 60*time.Minute {
		t.Errorf("ReceiveToTest expected 60 min, got %v", phase.ReceiveToTest.Minutes())
	}
	if phase.TestToReview != 0 {
		t.Errorf("TestToReview expected 0, got %v", phase.TestToReview)
	}
	if phase.ReviewToDone != 0 {
		t.Errorf("ReviewToDone expected 0, got %v", phase.ReviewToDone)
	}
	if phase.Total != 0 {
		t.Errorf("Total expected 0, got %v", phase.Total)
	}
}

func TestCalculateMedianMinutes(t *testing.T) {
	tests := []struct {
		name      string
		durations []time.Duration
		expected  float64
	}{
		{
			name:      "empty",
			durations: []time.Duration{},
			expected:  0,
		},
		{
			name:      "single",
			durations: []time.Duration{10 * time.Minute},
			expected:  10,
		},
		{
			name:      "odd count",
			durations: []time.Duration{10 * time.Minute, 20 * time.Minute, 30 * time.Minute},
			expected:  20,
		},
		{
			name:      "even count",
			durations: []time.Duration{10 * time.Minute, 20 * time.Minute, 30 * time.Minute, 40 * time.Minute},
			expected:  25,
		},
		{
			name:      "unsorted",
			durations: []time.Duration{30 * time.Minute, 10 * time.Minute, 20 * time.Minute},
			expected:  20,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculateMedianMinutes(tt.durations)
			if math.Abs(result-tt.expected) > 0.001 {
				t.Errorf("expected %.2f, got %.2f", tt.expected, result)
			}
		})
	}
}

func TestCalculatePercentileMinutes(t *testing.T) {
	durations := []time.Duration{
		10 * time.Minute,
		20 * time.Minute,
		30 * time.Minute,
		40 * time.Minute,
		50 * time.Minute,
	}

	tests := []struct {
		name       string
		percentile float64
		expected   float64
	}{
		{"p0", 0.0, 10},
		{"p50", 0.5, 30},
		{"p90", 0.9, 46},
		{"p100", 1.0, 50},
		{"p25", 0.25, 20},
		{"p75", 0.75, 40},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculatePercentileMinutes(durations, tt.percentile)
			if math.Abs(result-tt.expected) > 0.001 {
				t.Errorf("expected %.2f, got %.2f", tt.expected, result)
			}
		})
	}
}

func TestCalculatePercentileMinutesInvalid(t *testing.T) {
	if CalculatePercentileMinutes([]time.Duration{}, 0.5) != 0 {
		t.Error("empty slice should return 0")
	}
	if CalculatePercentileMinutes([]time.Duration{10 * time.Minute}, -0.1) != 0 {
		t.Error("invalid percentile should return 0")
	}
	if CalculatePercentileMinutes([]time.Duration{10 * time.Minute}, 1.1) != 0 {
		t.Error("invalid percentile should return 0")
	}
}

func TestAverageTATPhases(t *testing.T) {
	phases := []TATPhase{
		{ReceiveToTest: 30 * time.Minute, TestToReview: 60 * time.Minute, ReviewToDone: 15 * time.Minute, Total: 105 * time.Minute},
		{ReceiveToTest: 45 * time.Minute, TestToReview: 90 * time.Minute, ReviewToDone: 30 * time.Minute, Total: 165 * time.Minute},
		{ReceiveToTest: 60 * time.Minute, TestToReview: 30 * time.Minute, ReviewToDone: 45 * time.Minute, Total: 135 * time.Minute},
	}

	avgR2T, avgT2R, avgR2D, avgTotal := AverageTATPhases(phases)

	if math.Abs(avgR2T-45) > 0.001 {
		t.Errorf("avgR2T expected 45, got %.2f", avgR2T)
	}
	if math.Abs(avgT2R-60) > 0.001 {
		t.Errorf("avgT2R expected 60, got %.2f", avgT2R)
	}
	if math.Abs(avgR2D-30) > 0.001 {
		t.Errorf("avgR2D expected 30, got %.2f", avgR2D)
	}
	if math.Abs(avgTotal-135) > 0.001 {
		t.Errorf("avgTotal expected 135, got %.2f", avgTotal)
	}
}

func TestAverageTATPhasesEmpty(t *testing.T) {
	avgR2T, avgT2R, avgR2D, avgTotal := AverageTATPhases([]TATPhase{})
	if avgR2T != 0 || avgT2R != 0 || avgR2D != 0 || avgTotal != 0 {
		t.Error("empty phases should return all zeros")
	}
}

func TestAverageTATPhasesPartial(t *testing.T) {
	phases := []TATPhase{
		{ReceiveToTest: 30 * time.Minute, Total: 30 * time.Minute},
		{TestToReview: 60 * time.Minute},
		{ReceiveToTest: 50 * time.Minute, ReviewToDone: 20 * time.Minute, Total: 70 * time.Minute},
	}

	avgR2T, avgT2R, avgR2D, avgTotal := AverageTATPhases(phases)

	if math.Abs(avgR2T-40) > 0.001 {
		t.Errorf("avgR2T expected 40, got %.2f", avgR2T)
	}
	if math.Abs(avgT2R-60) > 0.001 {
		t.Errorf("avgT2R expected 60, got %.2f", avgT2R)
	}
	if math.Abs(avgR2D-20) > 0.001 {
		t.Errorf("avgR2D expected 20, got %.2f", avgR2D)
	}
	if math.Abs(avgTotal-50) > 0.001 {
		t.Errorf("avgTotal expected 50, got %.2f", avgTotal)
	}
}
