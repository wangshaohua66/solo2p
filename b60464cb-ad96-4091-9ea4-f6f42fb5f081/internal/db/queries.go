package db

import (
	"context"
	"fmt"
	"time"
)

func ListBerths(ctx context.Context) ([]Berth, error) {
	rows, err := Pool.Query(ctx, `
		SELECT id, name, length, quay_cranes, status, tidal_window, created_at, updated_at
		FROM berths ORDER BY id
	`)
	if err != nil {
		return nil, fmt.Errorf("query berths: %w", err)
	}
	defer rows.Close()

	var berths []Berth
	for rows.Next() {
		var b Berth
		if err := rows.Scan(&b.ID, &b.Name, &b.Length, &b.QuayCranes, &b.Status,
			&b.TidalWindow, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan berth: %w", err)
		}
		berths = append(berths, b)
	}
	return berths, rows.Err()
}

func GetAvailableBerths(ctx context.Context, vesselLength float64, start, end time.Time) ([]Berth, error) {
	rows, err := Pool.Query(ctx, `
		SELECT b.id, b.name, b.length, b.quay_cranes, b.status, b.tidal_window, b.created_at, b.updated_at
		FROM berths b
		WHERE b.status = 'available' AND b.length >= $1
		AND b.id NOT IN (
			SELECT berth_id FROM vessels
			WHERE status IN ('docked', 'working')
			AND (eta <= $3 AND etd >= $2)
		)
		ORDER BY b.length
	`, vesselLength, start, end)
	if err != nil {
		return nil, fmt.Errorf("query available berths: %w", err)
	}
	defer rows.Close()

	var berths []Berth
	for rows.Next() {
		var b Berth
		if err := rows.Scan(&b.ID, &b.Name, &b.Length, &b.QuayCranes, &b.Status,
			&b.TidalWindow, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan berth: %w", err)
		}
		berths = append(berths, b)
	}
	return berths, rows.Err()
}

func ListVessels(ctx context.Context, status string, berthID *int, etaFrom, etaTo *time.Time, offset, limit int) ([]Vessel, int, error) {
	var args []interface{}
	argIdx := 1
	query := `FROM vessels WHERE 1=1`
	countQuery := `SELECT COUNT(*) FROM vessels WHERE 1=1`

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if berthID != nil {
		query += fmt.Sprintf(" AND berth_id = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND berth_id = $%d", argIdx)
		args = append(args, *berthID)
		argIdx++
	}
	if etaFrom != nil {
		query += fmt.Sprintf(" AND eta >= $%d", argIdx)
		countQuery += fmt.Sprintf(" AND eta >= $%d", argIdx)
		args = append(args, *etaFrom)
		argIdx++
	}
	if etaTo != nil {
		query += fmt.Sprintf(" AND eta <= $%d", argIdx)
		countQuery += fmt.Sprintf(" AND eta <= $%d", argIdx)
		args = append(args, *etaTo)
		argIdx++
	}

	var total int
	if err := Pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count vessels: %w", err)
	}

	fullQuery := `SELECT id, name, imo, length, capacity, carried_teu, status, eta, etd,
		berth_id, loading_plan, unloading_plan, progress_percent, remaining_teu,
		created_at, updated_at ` + query +
		fmt.Sprintf(" ORDER BY eta LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := Pool.Query(ctx, fullQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query vessels: %w", err)
	}
	defer rows.Close()

	var vessels []Vessel
	for rows.Next() {
		var v Vessel
		if err := rows.Scan(&v.ID, &v.Name, &v.IMO, &v.Length, &v.Capacity, &v.CarriedTEU,
			&v.Status, &v.ETA, &v.ETD, &v.BerthID, &v.LoadingPlan, &v.UnloadingPlan,
			&v.ProgressPercent, &v.RemainingTEU, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan vessel: %w", err)
		}
		vessels = append(vessels, v)
	}
	return vessels, total, rows.Err()
}

func GetVesselByIMO(ctx context.Context, imo string) (*Vessel, error) {
	var v Vessel
	err := Pool.QueryRow(ctx, `
		SELECT id, name, imo, length, capacity, carried_teu, status, eta, etd,
			berth_id, loading_plan, unloading_plan, progress_percent, remaining_teu,
			created_at, updated_at
		FROM vessels WHERE imo = $1
	`, imo).Scan(&v.ID, &v.Name, &v.IMO, &v.Length, &v.Capacity, &v.CarriedTEU,
		&v.Status, &v.ETA, &v.ETD, &v.BerthID, &v.LoadingPlan, &v.UnloadingPlan,
		&v.ProgressPercent, &v.RemainingTEU, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get vessel: %w", err)
	}
	return &v, nil
}

func ListTrucks(ctx context.Context, status string) ([]Truck, error) {
	query := `SELECT id, plate_no, status, location_x, location_y, current_job_id,
		load_status, container_id, driver_name, daily_trips, daily_km, created_at, updated_at
		FROM trucks`
	var args []interface{}
	if status != "" {
		query += " WHERE status = $1"
		args = append(args, status)
	}
	query += " ORDER BY id"

	rows, err := Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query trucks: %w", err)
	}
	defer rows.Close()

	var trucks []Truck
	for rows.Next() {
		var t Truck
		if err := rows.Scan(&t.ID, &t.PlateNo, &t.Status, &t.LocationX, &t.LocationY,
			&t.CurrentJobID, &t.LoadStatus, &t.ContainerID, &t.DriverName, &t.DailyTrips,
			&t.DailyKM, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan truck: %w", err)
		}
		trucks = append(trucks, t)
	}
	return trucks, rows.Err()
}

func ListContainers(ctx context.Context, status string, bay int, offset, limit int) ([]Container, int, error) {
	var args []interface{}
	argIdx := 1
	base := `FROM containers WHERE 1=1`

	if status != "" {
		base += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if bay > 0 {
		base += fmt.Sprintf(" AND bay = $%d", argIdx)
		args = append(args, bay)
		argIdx++
	}

	var total int
	if err := Pool.QueryRow(ctx, "SELECT COUNT(*) "+base, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count containers: %w", err)
	}

	full := `SELECT id, container_no, size_type, status, location, bay, row, tier, weight,
		destination, is_hazardous, hazard_class, is_reefer, temp_set, has_power,
		customs_release, release_time, freight_forwarder, notify_sent, vessel_id,
		created_at, updated_at ` + base +
		fmt.Sprintf(" ORDER BY bay, row, tier LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := Pool.Query(ctx, full, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query containers: %w", err)
	}
	defer rows.Close()

	var containers []Container
	for rows.Next() {
		var c Container
		if err := rows.Scan(&c.ID, &c.ContainerNo, &c.SizeType, &c.Status, &c.Location,
			&c.Bay, &c.Row, &c.Tier, &c.Weight, &c.Destination, &c.IsHazardous,
			&c.HazardClass, &c.IsReefer, &c.TempSet, &c.HasPower, &c.CustomsRelease,
			&c.ReleaseTime, &c.FreightForwarder, &c.NotifySent, &c.VesselID,
			&c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan container: %w", err)
		}
		containers = append(containers, c)
	}
	return containers, total, rows.Err()
}

func GetReleasedNotPickedContainers(ctx context.Context) ([]Container, error) {
	rows, err := Pool.Query(ctx, `
		SELECT id, container_no, size_type, status, location, bay, row, tier, weight,
			destination, is_hazardous, hazard_class, is_reefer, temp_set, has_power,
			customs_release, release_time, freight_forwarder, notify_sent, vessel_id,
			created_at, updated_at
		FROM containers
		WHERE customs_release = true AND status = 'stored' AND notify_sent = false
		ORDER BY release_time
	`)
	if err != nil {
		return nil, fmt.Errorf("query released containers: %w", err)
	}
	defer rows.Close()

	var containers []Container
	for rows.Next() {
		var c Container
		if err := rows.Scan(&c.ID, &c.ContainerNo, &c.SizeType, &c.Status, &c.Location,
			&c.Bay, &c.Row, &c.Tier, &c.Weight, &c.Destination, &c.IsHazardous,
			&c.HazardClass, &c.IsReefer, &c.TempSet, &c.HasPower, &c.CustomsRelease,
			&c.ReleaseTime, &c.FreightForwarder, &c.NotifySent, &c.VesselID,
			&c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan container: %w", err)
		}
		containers = append(containers, c)
	}
	return containers, rows.Err()
}

func ListYardSlots(ctx context.Context, zone string, occupied *bool) ([]YardSlot, error) {
	var args []interface{}
	query := `SELECT id, bay, row, tier, zone, has_power, occupied, container_id FROM yard_slots WHERE 1=1`
	argIdx := 1

	if zone != "" {
		query += fmt.Sprintf(" AND zone = $%d", argIdx)
		args = append(args, zone)
		argIdx++
	}
	if occupied != nil {
		query += fmt.Sprintf(" AND occupied = $%d", argIdx)
		args = append(args, *occupied)
		argIdx++
	}
	query += " ORDER BY bay, row, tier"

	rows, err := Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query slots: %w", err)
	}
	defer rows.Close()

	var slots []YardSlot
	for rows.Next() {
		var s YardSlot
		if err := rows.Scan(&s.ID, &s.Bay, &s.Row, &s.Tier, &s.Zone,
			&s.HasPower, &s.Occupied, &s.ContainerID); err != nil {
			return nil, fmt.Errorf("scan slot: %w", err)
		}
		slots = append(slots, s)
	}
	return slots, rows.Err()
}

func GetYardStackOccupancy(ctx context.Context, bay, row int) ([]Container, error) {
	rows, err := Pool.Query(ctx, `
		SELECT c.id, c.container_no, c.size_type, c.status, c.location, c.bay, c.row, c.tier,
			c.weight, c.destination, c.is_hazardous, c.hazard_class, c.is_reefer, c.temp_set,
			c.has_power, c.customs_release, c.release_time, c.freight_forwarder,
			c.notify_sent, c.vessel_id, c.created_at, c.updated_at
		FROM containers c
		WHERE c.bay = $1 AND c.row = $2 AND c.status = 'stored'
		ORDER BY c.tier DESC
	`, bay, row)
	if err != nil {
		return nil, fmt.Errorf("query stack: %w", err)
	}
	defer rows.Close()

	var containers []Container
	for rows.Next() {
		var c Container
		if err := rows.Scan(&c.ID, &c.ContainerNo, &c.SizeType, &c.Status, &c.Location,
			&c.Bay, &c.Row, &c.Tier, &c.Weight, &c.Destination, &c.IsHazardous,
			&c.HazardClass, &c.IsReefer, &c.TempSet, &c.HasPower, &c.CustomsRelease,
			&c.ReleaseTime, &c.FreightForwarder, &c.NotifySent, &c.VesselID,
			&c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan container: %w", err)
		}
		containers = append(containers, c)
	}
	return containers, rows.Err()
}

func CreateBerthApplication(ctx context.Context, app *BerthApplication) error {
	err := Pool.QueryRow(ctx, `
		INSERT INTO berth_applications (
			vessel_name, vessel_imo, vessel_length, carried_teu, eta, etd,
			loading_teu, unloading_teu, status, shipping_company,
			contact_email, contact_phone, notes
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12)
		RETURNING id, created_at, updated_at
	`, app.VesselName, app.VesselIMO, app.VesselLength, app.CarriedTEU,
		app.ETA, app.ETD, app.LoadingTEU, app.UnloadingTEU,
		app.ShippingCompany, app.ContactEmail, app.ContactPhone, app.Notes).
		Scan(&app.ID, &app.CreatedAt, &app.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create application: %w", err)
	}
	return nil
}

func ListBerthApplications(ctx context.Context, status string) ([]BerthApplication, error) {
	var args []interface{}
	query := `SELECT id, vessel_name, vessel_imo, vessel_length, carried_teu,
		eta, etd, loading_teu, unloading_teu, status, assigned_berth, assigned_time,
		shipping_company, contact_email, contact_phone, notes, created_at, updated_at
		FROM berth_applications`
	if status != "" {
		query += " WHERE status = $1"
		args = append(args, status)
	}
	query += " ORDER BY created_at DESC"

	rows, err := Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query applications: %w", err)
	}
	defer rows.Close()

	var apps []BerthApplication
	for rows.Next() {
		var a BerthApplication
		if err := rows.Scan(&a.ID, &a.VesselName, &a.VesselIMO, &a.VesselLength,
			&a.CarriedTEU, &a.ETA, &a.ETD, &a.LoadingTEU, &a.UnloadingTEU,
			&a.Status, &a.AssignedBerth, &a.AssignedTime, &a.ShippingCompany,
			&a.ContactEmail, &a.ContactPhone, &a.Notes, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan application: %w", err)
		}
		apps = append(apps, a)
	}
	return apps, rows.Err()
}

func UpdateBerthAssignment(ctx context.Context, appID, berthID int) error {
	_, err := Pool.Exec(ctx, `
		UPDATE berth_applications
		SET assigned_berth = $1, assigned_time = NOW(), status = 'assigned'
		WHERE id = $2
	`, berthID, appID)
	if err != nil {
		return fmt.Errorf("update assignment: %w", err)
	}
	return nil
}

func MarkContainerNotified(ctx context.Context, id int) error {
	_, err := Pool.Exec(ctx,
		"UPDATE containers SET notify_sent = true WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("mark notified: %w", err)
	}
	return nil
}

func CreateJob(ctx context.Context, job *Job) error {
	err := Pool.QueryRow(ctx, `
		INSERT INTO jobs (type, status, container_id, pickup_location, dropoff_location,
			pickup_bay, dropoff_bay, estimated_time, distance, priority)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at
	`, job.Type, "pending", job.ContainerID, job.PickupLocation, job.DropoffLocation,
		job.PickupBay, job.DropoffBay, job.EstimatedTime, job.Distance, job.Priority).
		Scan(&job.ID, &job.CreatedAt, &job.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create job: %w", err)
	}
	return nil
}

func ListPendingJobs(ctx context.Context) ([]Job, error) {
	rows, err := Pool.Query(ctx, `
		SELECT id, type, status, container_id, truck_id, pickup_location,
			dropoff_location, pickup_bay, dropoff_bay, estimated_time, distance,
			start_time, end_time, priority, created_at, updated_at
		FROM jobs WHERE status = 'pending' ORDER BY priority DESC, created_at
	`)
	if err != nil {
		return nil, fmt.Errorf("query jobs: %w", err)
	}
	defer rows.Close()

	var jobs []Job
	for rows.Next() {
		var j Job
		if err := rows.Scan(&j.ID, &j.Type, &j.Status, &j.ContainerID, &j.TruckID,
			&j.PickupLocation, &j.DropoffLocation, &j.PickupBay, &j.DropoffBay,
			&j.EstimatedTime, &j.Distance, &j.StartTime, &j.EndTime, &j.Priority,
			&j.CreatedAt, &j.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan job: %w", err)
		}
		jobs = append(jobs, j)
	}
	return jobs, rows.Err()
}

func AssignJobToTruck(ctx context.Context, jobID, truckID int) error {
	_, err := Pool.Exec(ctx, `
		UPDATE jobs SET status = 'assigned', truck_id = $1, start_time = NOW() WHERE id = $2
	`, truckID, jobID)
	if err != nil {
		return fmt.Errorf("assign job: %w", err)
	}
	_, err = Pool.Exec(ctx, `
		UPDATE trucks SET status = 'working', current_job_id = $1 WHERE id = $2
	`, jobID, truckID)
	return err
}

func GetStatsBerthUtilization(ctx context.Context, start, end time.Time) (float64, error) {
	var util float64
	err := Pool.QueryRow(ctx, `
		SELECT COALESCE(
			SUM(EXTRACT(EPOCH FROM (LEAST(etd, $2) - GREATEST(eta, $1)))) /
			(NULLIF(EXTRACT(EPOCH FROM ($2 - $1)), 0) *
			 (SELECT COUNT(*) FROM berths))
		, 0) * 100
		FROM vessels
		WHERE status IN ('docked', 'working', 'departed')
		AND eta < $2 AND etd > $1
	`, start, end).Scan(&util)
	if err != nil {
		return 0, fmt.Errorf("berth utilization: %w", err)
	}
	return util, nil
}

func GetStatsAvgDwellTime(ctx context.Context, start, end time.Time) (float64, error) {
	var avg float64
	err := Pool.QueryRow(ctx, `
		SELECT COALESCE(AVG(EXTRACT(DAY FROM (updated_at - created_at))), 0)
		FROM containers
		WHERE status = 'picked_up'
		AND updated_at >= $1 AND updated_at <= $2
	`, start, end).Scan(&avg)
	if err != nil {
		return 0, fmt.Errorf("dwell time: %w", err)
	}
	return avg, nil
}

func GetStatsTruckEfficiency(ctx context.Context, start, end time.Time) (float64, float64, error) {
	var avgTrips float64
	var avgKM float64
	err := Pool.QueryRow(ctx, `
		SELECT COALESCE(AVG(daily_trips), 0), COALESCE(AVG(daily_km), 0)
		FROM trucks
	`).Scan(&avgTrips, &avgKM)
	if err != nil {
		return 0, 0, fmt.Errorf("truck efficiency: %w", err)
	}
	return avgTrips, avgKM, nil
}

func GetStatsYardTurnover(ctx context.Context, start, end time.Time) (float64, error) {
	var turnover float64
	err := Pool.QueryRow(ctx, `
		SELECT COALESCE(
			COUNT(*)::float / NULLIF((SELECT COUNT(*) FROM yard_slots WHERE occupied), 0), 0
		)
		FROM containers
		WHERE status = 'picked_up'
		AND updated_at >= $1 AND updated_at <= $2
	`, start, end).Scan(&turnover)
	if err != nil {
		return 0, fmt.Errorf("yard turnover: %w", err)
	}
	return turnover, nil
}
