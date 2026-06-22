package dispatcher

import (
	"context"
	"fmt"
	"time"

	"terminal-dispatcher/internal/config"
	"terminal-dispatcher/internal/db"
	"terminal-dispatcher/internal/notifier"
	"terminal-dispatcher/internal/optimizer"
)

type Dispatcher struct {
	cfg          *config.DispatchConfig
	yardOpt      *optimizer.YardOptimizer
	truckRouter  *optimizer.TruckRouter
	notifier     *notifier.Notifier
}

type BerthAssignment struct {
	BerthID   int
	BerthName string
	StartTime time.Time
	EndTime   time.Time
	Conflicts []string
}

func New(cfg *config.DispatchConfig, n *notifier.Notifier) *Dispatcher {
	return &Dispatcher{
		cfg:         cfg,
		yardOpt:     optimizer.NewYardOptimizer(&cfg.Yard),
		truckRouter: optimizer.NewTruckRouter(&cfg.Truck),
		notifier:    n,
	}
}

func (d *Dispatcher) AllocateBerth(ctx context.Context, app *db.BerthApplication) (*BerthAssignment, error) {
	berths, err := db.ListBerths(ctx)
	if err != nil {
		return nil, fmt.Errorf("list berths: %w", err)
	}

	candidates := make([]db.Berth, 0)
	var conflicts []string

	for _, b := range berths {
		if b.Status != "available" {
			conflicts = append(conflicts, fmt.Sprintf("泊位%s状态为%s", b.Name, b.Status))
			continue
		}
		if b.Length < app.VesselLength+d.cfg.Berth.SafetyDistance*2 {
			conflicts = append(conflicts, fmt.Sprintf("泊位%s长度不足(%.0fm < %.0fm+安全间距)", b.Name, b.Length, app.VesselLength))
			continue
		}

		if d.checkBerthConflict(ctx, b.ID, app.ETA, app.ETD) {
			conflicts = append(conflicts, fmt.Sprintf("泊位%s在%s至%s期间有船占用", b.Name, app.ETA.Format("01-02 15:04"), app.ETD.Format("01-02 15:04")))
			continue
		}

		candidates = append(candidates, b)
	}

	if len(candidates) == 0 {
		return &BerthAssignment{
			Conflicts: conflicts,
		}, fmt.Errorf("no available berth")
	}

	best := candidates[0]
	bestScore := d.scoreBerth(&best, app)
	for i := 1; i < len(candidates); i++ {
		score := d.scoreBerth(&candidates[i], app)
		if score > bestScore {
			best = candidates[i]
			bestScore = score
		}
	}

	return &BerthAssignment{
		BerthID:   best.ID,
		BerthName: best.Name,
		StartTime: app.ETA,
		EndTime:   app.ETD,
		Conflicts: conflicts,
	}, nil
}

func (d *Dispatcher) scoreBerth(b *db.Berth, app *db.BerthApplication) float64 {
	score := 0.0
	score += float64(b.QuayCranes) * 10
	lengthFit := 100 - (b.Length-app.VesselLength)/b.Length*50
	score += lengthFit
	return score
}

func (d *Dispatcher) checkBerthConflict(ctx context.Context, berthID int, start, end time.Time) bool {
	vessels, _, err := db.ListVessels(ctx, "", &berthID, nil, nil, 0, 100)
	if err != nil {
		return true
	}
	for _, v := range vessels {
		if v.Status == "departed" || v.Status == "cancelled" {
			continue
		}
		if v.ETA.Before(end) && v.ETD.After(start) {
			return true
		}
	}
	return false
}

func (d *Dispatcher) OptimizeYard(ctx context.Context, containers []db.Container, slots []db.YardSlot) (map[int]db.YardSlot, error) {
	return d.yardOpt.OptimizePlacementBatch(containers, slots)
}

func (d *Dispatcher) GetRestackWarnings(ctx context.Context, containers []db.Container) ([]db.RestackWarning, error) {
	return d.yardOpt.FindRestackWarnings(containers)
}

func (d *Dispatcher) DispatchTrucks(ctx context.Context) ([]optimizer.RoutePlan, error) {
	trucks, err := db.ListTrucks(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("list trucks: %w", err)
	}

	jobs, err := db.ListPendingJobs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list jobs: %w", err)
	}

	return d.truckRouter.Dispatch(trucks, jobs)
}

func (d *Dispatcher) AssignJob(ctx context.Context, jobID, truckID int) error {
	return db.AssignJobToTruck(ctx, jobID, truckID)
}

func (d *Dispatcher) CheckCustomsRelease(ctx context.Context) ([]db.Container, error) {
	containers, err := db.GetReleasedNotPickedContainers(ctx)
	if err != nil {
		return nil, fmt.Errorf("get released containers: %w", err)
	}
	return containers, nil
}

func (d *Dispatcher) SendReleaseNotifications(ctx context.Context, containers []db.Container) (int, error) {
	sent := 0
	for _, c := range containers {
		if c.FreightForwarder != "" {
			err := d.notifier.NotifyRelease(c.ContainerNo, c.FreightForwarder, "ff@example.com")
			if err != nil {
				continue
			}
		}
		if err := db.MarkContainerNotified(ctx, c.ID); err != nil {
			continue
		}
		sent++
	}
	return sent, nil
}

type OperationStats struct {
	BerthUtilization float64
	YardTurnover     float64
	AvgDwellDays     float64
	AvgTruckTrips    float64
	AvgTruckKM       float64
}

func (d *Dispatcher) GetStats(ctx context.Context, period string) (*OperationStats, error) {
	end := time.Now()
	var start time.Time

	switch period {
	case "day":
		start = end.AddDate(0, 0, -1)
	case "week":
		start = end.AddDate(0, 0, -7)
	case "month":
		start = end.AddDate(0, -1, 0)
	default:
		start = end.AddDate(0, 0, -7)
	}

	berthUtil, err := db.GetStatsBerthUtilization(ctx, start, end)
	if err != nil {
		return nil, err
	}

	yardTurn, err := db.GetStatsYardTurnover(ctx, start, end)
	if err != nil {
		return nil, err
	}

	dwell, err := db.GetStatsAvgDwellTime(ctx, start, end)
	if err != nil {
		return nil, err
	}

	trips, km, err := db.GetStatsTruckEfficiency(ctx, start, end)
	if err != nil {
		return nil, err
	}

	return &OperationStats{
		BerthUtilization: berthUtil,
		YardTurnover:     yardTurn,
		AvgDwellDays:     dwell,
		AvgTruckTrips:    trips,
		AvgTruckKM:       km,
	}, nil
}

func (d *Dispatcher) CreateBerthApplication(ctx context.Context, app *db.BerthApplication) error {
	return db.CreateBerthApplication(ctx, app)
}

func (d *Dispatcher) ListBerthApplications(ctx context.Context, status string) ([]db.BerthApplication, error) {
	return db.ListBerthApplications(ctx, status)
}

func (d *Dispatcher) UpdateBerthAssignment(ctx context.Context, appID, berthID int) error {
	return db.UpdateBerthAssignment(ctx, appID, berthID)
}
