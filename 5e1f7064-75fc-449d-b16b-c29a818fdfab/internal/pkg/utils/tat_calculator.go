package utils

import (
	"sort"
	"time"
)

type TATPhase struct {
	ReceiveToTest  time.Duration
	TestToReview   time.Duration
	ReviewToDone   time.Duration
	Total          time.Duration
}

func CalculateTATPhase(receivedAt, testingAt, reviewingAt, completedAt time.Time) TATPhase {
	var phase TATPhase
	if !receivedAt.IsZero() && !testingAt.IsZero() {
		phase.ReceiveToTest = testingAt.Sub(receivedAt)
	}
	if !testingAt.IsZero() && !reviewingAt.IsZero() {
		phase.TestToReview = reviewingAt.Sub(testingAt)
	}
	if !reviewingAt.IsZero() && !completedAt.IsZero() {
		phase.ReviewToDone = completedAt.Sub(reviewingAt)
	}
	if !receivedAt.IsZero() && !completedAt.IsZero() {
		phase.Total = completedAt.Sub(receivedAt)
	}
	return phase
}

func CalculateMedianMinutes(durations []time.Duration) float64 {
	if len(durations) == 0 {
		return 0
	}
	minutes := make([]float64, len(durations))
	for i, d := range durations {
		minutes[i] = d.Minutes()
	}
	sort.Float64s(minutes)
	n := len(minutes)
	if n%2 == 1 {
		return minutes[n/2]
	}
	return (minutes[n/2-1] + minutes[n/2]) / 2.0
}

func CalculatePercentileMinutes(durations []time.Duration, percentile float64) float64 {
	if len(durations) == 0 || percentile < 0 || percentile > 1 {
		return 0
	}
	minutes := make([]float64, len(durations))
	for i, d := range durations {
		minutes[i] = d.Minutes()
	}
	sort.Float64s(minutes)
	n := len(minutes)
	if n == 1 {
		return minutes[0]
	}
	rank := percentile * float64(n-1)
	lower := int(rank)
	frac := rank - float64(lower)
	if lower+1 >= n {
		return minutes[n-1]
	}
	return minutes[lower] + frac*(minutes[lower+1]-minutes[lower])
}

func AverageTATPhases(phases []TATPhase) (avgReceiveToTest, avgTestToReview, avgReviewToDone, avgTotal float64) {
	if len(phases) == 0 {
		return 0, 0, 0, 0
	}
	var sumR2T, sumT2R, sumR2D, sumTotal time.Duration
	var countR2T, countT2R, countR2D, countTotal int
	for _, p := range phases {
		if p.ReceiveToTest > 0 {
			sumR2T += p.ReceiveToTest
			countR2T++
		}
		if p.TestToReview > 0 {
			sumT2R += p.TestToReview
			countT2R++
		}
		if p.ReviewToDone > 0 {
			sumR2D += p.ReviewToDone
			countR2D++
		}
		if p.Total > 0 {
			sumTotal += p.Total
			countTotal++
		}
	}
	if countR2T > 0 {
		avgReceiveToTest = sumR2T.Minutes() / float64(countR2T)
	}
	if countT2R > 0 {
		avgTestToReview = sumT2R.Minutes() / float64(countT2R)
	}
	if countR2D > 0 {
		avgReviewToDone = sumR2D.Minutes() / float64(countR2D)
	}
	if countTotal > 0 {
		avgTotal = sumTotal.Minutes() / float64(countTotal)
	}
	return
}
