package repository

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"offshore-wind-ops/internal/model"
)

type AlertRepository struct {
	collection *mongo.Collection
}

func NewAlertRepository(db *mongo.Database) *AlertRepository {
	return &AlertRepository{
		collection: db.Collection(CollectionAlerts),
	}
}

func (r *AlertRepository) Create(ctx context.Context, alert *model.Alert) error {
	now := time.Now()
	alert.CreatedAt = now
	alert.UpdatedAt = now
	if alert.AlertNo == "" {
		alert.AlertNo = generateAlertNo(alert.Type, now)
	}
	if alert.Status == "" {
		alert.Status = model.AlertStatusNew
	}
	result, err := r.collection.InsertOne(ctx, alert)
	if err == nil {
		alert.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *AlertRepository) GetByID(ctx context.Context, id string) (*model.Alert, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var alert model.Alert
	err = r.collection.FindOne(ctx, bson.M{"_id": oid}).Decode(&alert)
	return &alert, err
}

func (r *AlertRepository) List(ctx context.Context, filter bson.M, page, pageSize int) ([]model.Alert, int64, error) {
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var list []model.Alert
	if err = cursor.All(ctx, &list); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *AlertRepository) Acknowledge(ctx context.Context, id, userID string) error {
	now := time.Now()
	_, err := r.collection.UpdateByID(ctx, id, bson.M{
		"$set": bson.M{
			"status":          model.AlertStatusAcknowledged,
			"acknowledged_by": userID,
			"acknowledged_at": now,
			"updated_at":      now,
		},
	})
	return err
}

func (r *AlertRepository) Resolve(ctx context.Context, id, userID, resolution string) error {
	now := time.Now()
	_, err := r.collection.UpdateByID(ctx, id, bson.M{
		"$set": bson.M{
			"status":     model.AlertStatusResolved,
			"resolved_by": userID,
			"resolved_at": now,
			"resolution":  resolution,
			"updated_at":  now,
		},
	})
	return err
}

func (r *AlertRepository) Assign(ctx context.Context, id, assignee string) error {
	_, err := r.collection.UpdateByID(ctx, id, bson.M{
		"$set": bson.M{
			"assigned_to": assignee,
			"status":      model.AlertStatusProcessing,
			"updated_at":  time.Now(),
		},
	})
	return err
}

func (r *AlertRepository) CountByStatus(ctx context.Context, filter bson.M) (map[string]int, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: filter}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$status"},
			{Key: "count", Value: bson.M{"$sum": 1}},
		}}},
	}

	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	result := make(map[string]int)
	var items []struct {
		ID    string `bson:"_id"`
		Count int    `bson:"count"`
	}
	if err = cursor.All(ctx, &items); err != nil {
		return nil, err
	}
	for _, item := range items {
		result[item.ID] = item.Count
	}
	return result, nil
}

func generateAlertNo(alertType model.AlertType, t time.Time) string {
	prefix := "ALT"
	switch alertType {
	case model.AlertTypeHealth:
		prefix = "HLT"
	case model.AlertTypeWeather:
		prefix = "WTH"
	case model.AlertTypeCertificate:
		prefix = "CRT"
	case model.AlertTypeInventory:
		prefix = "INV"
	case model.AlertTypeSafety:
		prefix = "SAF"
	}
	return fmt.Sprintf("%s%s%06d", prefix, t.Format("20060102150405"), time.Now().UnixNano()%1000000)
}

type ReportRepository struct {
	db *mongo.Database
}

func NewReportRepository(db *mongo.Database) *ReportRepository {
	return &ReportRepository{db: db}
}

func (r *ReportRepository) GetMTBFReport(ctx context.Context, req *model.ReportRequest) ([]model.MTBFReport, error) {
	matchStage := bson.M{}
	if req.WindFarmID != "" {
		matchStage["wind_farm_id"] = req.WindFarmID
	}
	if req.StartTime != nil {
		matchStage["created_at"] = bson.M{"$gte": *req.StartTime}
	}
	if req.EndTime != nil {
		if _, ok := matchStage["created_at"]; ok {
			matchStage["created_at"].(bson.M)["$lte"] = *req.EndTime
		} else {
			matchStage["created_at"] = bson.M{"$lte": *req.EndTime}
		}
	}

	groupID := bson.M{}
	switch req.GroupBy {
	case "wind_farm":
		groupID["wind_farm_id"] = "$wind_farm_id"
	case "turbine_model":
		groupID["turbine_model"] = "$turbine_model"
	case "fault_type":
		groupID["fault_type"] = "$source"
	default:
		groupID["wind_farm_id"] = "$wind_farm_id"
		groupID["turbine_model"] = "$turbine_model"
	}

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: matchStage}},
		{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: CollectionTurbines},
			{Key: "localField", Value: "turbine_id"},
			{Key: "foreignField", Value: "_id"},
			{Key: "as", Value: "turbine"},
		}}},
		{{Key: "$unwind", Value: "$turbine"}},
		{{Key: "$addFields", Value: bson.M{
			"turbine_model": "$turbine.model",
		}}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: groupID},
			{Key: "total_faults", Value: bson.M{"$sum": 1}},
			{Key: "total_runtime_hours", Value: bson.M{"$sum": 8760}},
		}}},
		{{Key: "$addFields", Value: bson.M{
			"mtbf_hours": bson.M{"$divide": []interface{}{"$total_runtime_hours", "$total_faults"}},
		}}},
		{{Key: "$project", Value: bson.M{
			"wind_farm_id":     "$_id.wind_farm_id",
			"turbine_model":    "$_id.turbine_model",
			"fault_type":       "$_id.fault_type",
			"total_faults":     1,
			"total_runtime_hours": 1,
			"mtbf_hours":       1,
			"_id":              0,
		}}},
	}

	coll := r.db.Collection(CollectionWorkOrders)
	cursor, err := coll.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []model.MTBFReport
	err = cursor.All(ctx, &results)
	return results, err
}

func (r *ReportRepository) GetMTTRReport(ctx context.Context, req *model.ReportRequest) ([]model.MTTRReport, error) {
	matchStage := bson.M{
		"status": bson.M{
			"$in": []model.WorkOrderStatus{
				model.WOStatusCompleted,
				model.WOStatusClosed,
			},
		},
		"start_time":     bson.M{"$exists": true},
		"completed_time": bson.M{"$exists": true},
	}
	if req.WindFarmID != "" {
		matchStage["wind_farm_id"] = req.WindFarmID
	}
	if req.StartTime != nil {
		matchStage["created_at"] = bson.M{"$gte": *req.StartTime}
	}
	if req.EndTime != nil {
		if _, ok := matchStage["created_at"]; ok {
			matchStage["created_at"].(bson.M)["$lte"] = *req.EndTime
		} else {
			matchStage["created_at"] = bson.M{"$lte": *req.EndTime}
		}
	}

	groupID := bson.M{}
	switch req.GroupBy {
	case "wind_farm":
		groupID["wind_farm_id"] = "$wind_farm_id"
	case "turbine_model":
		groupID["turbine_model"] = "$turbine_model"
	case "fault_type":
		groupID["fault_type"] = "$source"
	default:
		groupID["wind_farm_id"] = "$wind_farm_id"
		groupID["turbine_model"] = "$turbine_model"
	}

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: matchStage}},
		{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: CollectionTurbines},
			{Key: "localField", Value: "turbine_id"},
			{Key: "foreignField", Value: "_id"},
			{Key: "as", Value: "turbine"},
		}}},
		{{Key: "$unwind", Value: "$turbine"}},
		{{Key: "$addFields", Value: bson.M{
			"turbine_model":  "$turbine.model",
			"repair_duration": bson.M{"$divide": []interface{}{
				bson.M{"$subtract": []interface{}{"$completed_time", "$start_time"}},
				3600000,
			}},
		}}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: groupID},
			{Key: "total_repairs", Value: bson.M{"$sum": 1}},
			{Key: "total_repair_time_hours", Value: bson.M{"$sum": "$repair_duration"}},
		}}},
		{{Key: "$addFields", Value: bson.M{
			"mttr_hours": bson.M{"$divide": []interface{}{"$total_repair_time_hours", "$total_repairs"}},
		}}},
		{{Key: "$project", Value: bson.M{
			"wind_farm_id":         "$_id.wind_farm_id",
			"turbine_model":        "$_id.turbine_model",
			"fault_type":           "$_id.fault_type",
			"total_repairs":        1,
			"total_repair_time_hours": 1,
			"mttr_hours":           1,
			"_id":                  0,
		}}},
	}

	coll := r.db.Collection(CollectionWorkOrders)
	cursor, err := coll.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []model.MTTRReport
	err = cursor.All(ctx, &results)
	return results, err
}

func (r *ReportRepository) GetHealthTrend(ctx context.Context, turbineID string, start, end time.Time) ([]model.TrendDataPoint, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{
			"turbine_id": turbineID,
			"timestamp": bson.M{
				"$gte": start,
				"$lte": end,
			},
		}}},
		{{Key: "$sort", Value: bson.D{{Key: "timestamp", Value: 1}}}},
		{{Key: "$project", Value: bson.M{
			"timestamp": 1,
			"value":     "$overall_score",
			"_id":       0,
		}}},
	}

	cursor, err := r.db.Collection(CollectionHealthScores).Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var points []model.TrendDataPoint
	err = cursor.All(ctx, &points)
	return points, err
}

func (r *ReportRepository) GetDashboardSummary(ctx context.Context) (*model.DashboardSummary, error) {
	summary := &model.DashboardSummary{}

	wfCount, err := r.db.Collection(CollectionWindFarms).CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	summary.TotalWindFarms = int(wfCount)

	tCount, err := r.db.Collection(CollectionTurbines).CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	summary.TotalTurbines = int(tCount)

	activeVoyages, err := r.db.Collection(CollectionVoyages).CountDocuments(ctx, bson.M{
		"status": bson.M{"$in": []model.VoyageStatus{model.VoyageStatusSailing, model.VoyageStatusApproved}},
	})
	if err != nil {
		return nil, err
	}
	summary.ActiveVoyages = int(activeVoyages)

	openWO, err := r.db.Collection(CollectionWorkOrders).CountDocuments(ctx, bson.M{
		"status": bson.M{"$in": []model.WorkOrderStatus{
			model.WOStatusCreated,
			model.WOStatusAssigned,
			model.WOStatusInProgress,
			model.WOStatusPending,
		}},
	})
	if err != nil {
		return nil, err
	}
	summary.OpenWorkOrders = int(openWO)

	criticalAlerts, err := r.db.Collection(CollectionAlerts).CountDocuments(ctx, bson.M{
		"severity": model.SeverityCritical,
		"status":   bson.M{"$ne": model.AlertStatusResolved},
	})
	if err != nil {
		return nil, err
	}
	summary.CriticalAlerts = int(criticalAlerts)

	weatherAlerts, err := r.db.Collection(CollectionAlerts).CountDocuments(ctx, bson.M{
		"type":   model.AlertTypeWeather,
		"status": bson.M{"$ne": model.AlertStatusResolved},
	})
	if err != nil {
		return nil, err
	}
	summary.WeatherAlerts = int(weatherAlerts)

	personnelAtSea, err := r.db.Collection(CollectionPersonnel).CountDocuments(ctx, bson.M{
		"status":             model.PersonnelStatusOnDuty,
		"current_voyage_id": bson.M{"$ne": ""},
	})
	if err != nil {
		return nil, err
	}
	summary.PersonnelAtSea = int(personnelAtSea)

	overviewPipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$wind_farm_id"},
			{Key: "total_turbines", Value: bson.M{"$sum": 1}},
			{Key: "normal_count", Value: bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$status", model.TurbineStatusNormal}}, 1, 0}}}},
			{Key: "warning_count", Value: bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$status", model.TurbineStatusWarning}}, 1, 0}}}},
			{Key: "fault_count", Value: bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$status", model.TurbineStatusFault}}, 1, 0}}}},
			{Key: "offline_count", Value: bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$status", model.TurbineStatusOffline}}, 1, 0}}}},
			{Key: "avg_health_score", Value: bson.M{"$avg": "$health_score"}},
		}}},
	}

	cursor, err := r.db.Collection(CollectionTurbines).Aggregate(ctx, overviewPipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var overviews []model.HealthOverview
	if err = cursor.All(ctx, &overviews); err != nil {
		return nil, err
	}
	summary.HealthOverviews = overviews

	return summary, nil
}
