package optimizer

import (
	"fmt"
	"math"
	"sort"

	"terminal-dispatcher/internal/config"
	"terminal-dispatcher/internal/db"
)

type TruckRouter struct {
	cfg *config.TruckConfig
}

type RoutePlan struct {
	TruckID       int
	TruckPlate    string
	Jobs          []db.Job
	TotalDistance float64
	TotalTime     float64
	IdleTime      float64
	Order         []int
}

type Location struct {
	X float64
	Y float64
}

const (
	quayCraneX = 0.0
	quayCraneY = 0.0
)

func NewTruckRouter(cfg *config.TruckConfig) *TruckRouter {
	return &TruckRouter{cfg: cfg}
}

func (r *TruckRouter) Dispatch(trucks []db.Truck, jobs []db.Job) ([]RoutePlan, error) {
	if len(trucks) == 0 {
		return nil, fmt.Errorf("no available trucks")
	}
	if len(jobs) == 0 {
		return nil, fmt.Errorf("no pending jobs")
	}

	idleTrucks := make([]db.Truck, 0)
	for _, t := range trucks {
		if t.Status == "idle" {
			idleTrucks = append(idleTrucks, t)
		}
	}

	if len(idleTrucks) == 0 {
		return nil, fmt.Errorf("no idle trucks available")
	}

	plans := make([]RoutePlan, 0)
	assignedJobs := make(map[int]bool)

	sort.Slice(jobs, func(i, j int) bool {
		return jobs[i].Priority > jobs[j].Priority
	})

	for _, t := range idleTrucks {
		if len(assignedJobs) >= len(jobs) {
			break
		}

		plan := r.planSingleRoute(t, jobs, assignedJobs, 3)
		if len(plan.Jobs) > 0 {
			for _, j := range plan.Jobs {
				assignedJobs[j.ID] = true
			}
			plans = append(plans, plan)
		}
	}

	return plans, nil
}

func (r *TruckRouter) planSingleRoute(truck db.Truck, jobs []db.Job, assigned map[int]bool, maxJobs int) RoutePlan {
	plan := RoutePlan{
		TruckID:    truck.ID,
		TruckPlate: truck.PlateNo,
	}

	current := Location{X: truck.LocationX, Y: truck.LocationY}
	totalDist := 0.0
	jobCount := 0

	for i := 0; i < maxJobs && jobCount < len(jobs); i++ {
		bestIdx := -1
		bestDist := math.MaxFloat64

		for j, job := range jobs {
			if assigned[j] || containsJob(plan.Jobs, job.ID) {
				continue
			}
			if job.Type != "single_cycle" && job.Type != "multi_cycle" && job.Type != "pickup" && job.Type != "delivery" {
				continue
			}

			pickup := r.jobPickupLocation(&job)
			dist := distance(current, pickup)

			if dist < bestDist {
				bestDist = dist
				bestIdx = j
			}
		}

		if bestIdx == -1 {
			break
		}

		job := jobs[bestIdx]
		pickup := r.jobPickupLocation(&job)
		dropoff := r.jobDropoffLocation(&job)

		leg1 := distance(current, pickup)
		leg2 := distance(pickup, dropoff)

		plan.Jobs = append(plan.Jobs, job)
		plan.Order = append(plan.Order, job.ID)
		totalDist += leg1 + leg2

		current = dropoff
		jobCount++
	}

	plan.TotalDistance = totalDist
	plan.TotalTime = totalDist / r.cfg.AvgSpeed

	return plan
}

func (r *TruckRouter) jobPickupLocation(job *db.Job) Location {
	if job.PickupLocation == "quay" {
		return Location{X: quayCraneX, Y: quayCraneY + float64(job.PickupBay)*5}
	}
	return Location{X: 100 + float64(job.PickupBay)*6, Y: 50}
}

func (r *TruckRouter) jobDropoffLocation(job *db.Job) Location {
	if job.DropoffLocation == "quay" {
		return Location{X: quayCraneX, Y: quayCraneY + float64(job.DropoffBay)*5}
	}
	return Location{X: 100 + float64(job.DropoffBay)*6, Y: 50}
}

func distance(a, b Location) float64 {
	return math.Sqrt((a.X-b.X)*(a.X-b.X) + (a.Y-b.Y)*(a.Y-b.Y))
}

func containsJob(jobs []db.Job, id int) bool {
	for _, j := range jobs {
		if j.ID == id {
			return true
		}
	}
	return false
}

func (r *TruckRouter) OptimizeMultiCycle(trucks []db.Truck, jobs []db.Job) ([]RoutePlan, error) {
	multiJobs := make([]db.Job, 0)
	for _, j := range jobs {
		if j.Type == "multi_cycle" || j.Type == "delivery" {
			multiJobs = append(multiJobs, j)
		}
	}

	return r.Dispatch(trucks, multiJobs)
}

func (r *TruckRouter) CalculateETAs(plans []RoutePlan) map[int]float64 {
	etas := make(map[int]float64)
	for _, plan := range plans {
		cumulative := 0.0
		for i, job := range plan.Jobs {
			if i == 0 {
				cumulative += job.EstimatedTime / 2
			}
			cumulative += job.EstimatedTime
			etas[job.ID] = cumulative
		}
	}
	return etas
}

func (r *TruckRouter) ComputeFleetMetrics(trucks []db.Truck) (float64, float64, float64) {
	total := len(trucks)
	idle := 0
	working := 0
	maintenance := 0

	for _, t := range trucks {
		switch t.Status {
		case "idle":
			idle++
		case "working":
			working++
		case "maintenance":
			maintenance++
		}
	}

	idleRate := float64(idle) / float64(total) * 100
	utilization := float64(working) / float64(total) * 100
	maintRate := float64(maintenance) / float64(total) * 100

	return idleRate, utilization, maintRate
}

func (r *TruckRouter) EstimateEmptyRun(job *db.Job, truck *db.Truck) float64 {
	current := Location{X: truck.LocationX, Y: truck.LocationY}
	pickup := r.jobPickupLocation(job)
	return distance(current, pickup)
}
