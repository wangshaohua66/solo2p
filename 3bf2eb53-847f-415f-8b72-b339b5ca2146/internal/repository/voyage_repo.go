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

type WorkOrderRepository struct {
	collection        *mongo.Collection
	inspectionColl    *mongo.Collection
}

func NewWorkOrderRepository(db *mongo.Database) *WorkOrderRepository {
	return &WorkOrderRepository{
		collection:     db.Collection(CollectionWorkOrders),
		inspectionColl: db.Collection(CollectionInspectionReports),
	}
}

func (r *WorkOrderRepository) Create(ctx context.Context, wo *model.WorkOrder) error {
	now := time.Now()
	wo.CreatedAt = now
	wo.UpdatedAt = now
	if wo.OrderNo == "" {
		wo.OrderNo = generateOrderNo("WO", now)
	}
	result, err := r.collection.InsertOne(ctx, wo)
	if err == nil {
		wo.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *WorkOrderRepository) GetByID(ctx context.Context, id string) (*model.WorkOrder, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var wo model.WorkOrder
	err = r.collection.FindOne(ctx, bson.M{"_id": oid}).Decode(&wo)
	return &wo, err
}

func (r *WorkOrderRepository) List(ctx context.Context, filter bson.M, page, pageSize int) ([]model.WorkOrder, int64, error) {
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

	var list []model.WorkOrder
	if err = cursor.All(ctx, &list); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *WorkOrderRepository) Update(ctx context.Context, wo *model.WorkOrder) error {
	wo.UpdatedAt = time.Now()
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": wo.ID}, bson.M{"$set": wo})
	return err
}

func (r *WorkOrderRepository) UpdateStatus(ctx context.Context, id string, status model.WorkOrderStatus, note string) error {
	update := bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": time.Now(),
		},
	}
	if status == model.WOStatusInProgress {
		update["$set"].(bson.M)["start_time"] = time.Now()
	} else if status == model.WOStatusCompleted {
		update["$set"].(bson.M)["completed_time"] = time.Now()
	} else if status == model.WOStatusClosed {
		update["$set"].(bson.M)["closed_time"] = time.Now()
	}
	_, err := r.collection.UpdateByID(ctx, id, update)
	return err
}

func (r *WorkOrderRepository) AddSparePartUsage(ctx context.Context, woID string, usage model.SparePartUsage) error {
	_, err := r.collection.UpdateByID(ctx, woID, bson.M{
		"$push": bson.M{"spare_parts": usage},
		"$set":  bson.M{"updated_at": time.Now()},
	})
	return err
}

func (r *WorkOrderRepository) CreateInspectionReport(ctx context.Context, report *model.InspectionReport) error {
	report.ID = primitive.NewObjectID()
	report.CreatedAt = time.Now()
	_, err := r.inspectionColl.InsertOne(ctx, report)
	return err
}

func (r *WorkOrderRepository) GetInspectionReport(ctx context.Context, woID string) (*model.InspectionReport, error) {
	var report model.InspectionReport
	err := r.inspectionColl.FindOne(ctx, bson.M{"work_order_id": woID}).Decode(&report)
	return &report, err
}

type VoyageRepository struct {
	collection *mongo.Collection
	shipColl   *mongo.Collection
	weatherWinColl *mongo.Collection
	weatherFrcColl *mongo.Collection
}

func NewVoyageRepository(db *mongo.Database) *VoyageRepository {
	return &VoyageRepository{
		collection:     db.Collection(CollectionVoyages),
		shipColl:       db.Collection(CollectionShips),
		weatherWinColl: db.Collection(CollectionWeatherWindows),
		weatherFrcColl: db.Collection(CollectionWeatherForecasts),
	}
}

func (r *VoyageRepository) CreateShip(ctx context.Context, ship *model.Ship) error {
	now := time.Now()
	ship.CreatedAt = now
	ship.UpdatedAt = now
	result, err := r.shipColl.InsertOne(ctx, ship)
	if err == nil {
		ship.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *VoyageRepository) GetShip(ctx context.Context, id string) (*model.Ship, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var ship model.Ship
	err = r.shipColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&ship)
	return &ship, err
}

func (r *VoyageRepository) ListShips(ctx context.Context, filter bson.M) ([]model.Ship, error) {
	cursor, err := r.shipColl.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var ships []model.Ship
	err = cursor.All(ctx, &ships)
	return ships, err
}

func (r *VoyageRepository) UpdateShip(ctx context.Context, ship *model.Ship) error {
	ship.UpdatedAt = time.Now()
	_, err := r.shipColl.UpdateOne(ctx, bson.M{"_id": ship.ID}, bson.M{"$set": ship})
	return err
}

func (r *VoyageRepository) CreateVoyage(ctx context.Context, v *model.Voyage) error {
	now := time.Now()
	v.CreatedAt = now
	v.UpdatedAt = now
	if v.VoyageNo == "" {
		v.VoyageNo = generateOrderNo("VY", now)
	}
	result, err := r.collection.InsertOne(ctx, v)
	if err == nil {
		v.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *VoyageRepository) GetVoyage(ctx context.Context, id string) (*model.Voyage, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var v model.Voyage
	err = r.collection.FindOne(ctx, bson.M{"_id": oid}).Decode(&v)
	return &v, err
}

func (r *VoyageRepository) ListVoyages(ctx context.Context, filter bson.M, page, pageSize int) ([]model.Voyage, int64, error) {
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "departure_time", Value: -1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var list []model.Voyage
	if err = cursor.All(ctx, &list); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *VoyageRepository) UpdateVoyage(ctx context.Context, v *model.Voyage) error {
	v.UpdatedAt = time.Now()
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": v.ID}, bson.M{"$set": v})
	return err
}

func (r *VoyageRepository) UpdateVoyageStatus(ctx context.Context, id string, status model.VoyageStatus) error {
	_, err := r.collection.UpdateByID(ctx, id, bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": time.Now(),
		},
	})
	return err
}

func (r *VoyageRepository) CheckShipConflict(ctx context.Context, shipID string, start, end time.Time, excludeID string) ([]model.Voyage, error) {
	filter := bson.M{
		"ship_id": shipID,
		"status": bson.M{
			"$in": []model.VoyageStatus{
				model.VoyageStatusApproved,
				model.VoyageStatusSailing,
			},
		},
		"$and": []bson.M{
			{"departure_time": bson.M{"$lt": end}},
			{"return_time": bson.M{"$gt": start}},
		},
	}
	if excludeID != "" {
		oid, err := primitive.ObjectIDFromHex(excludeID)
		if err == nil {
			filter["_id"] = bson.M{"$ne": oid}
		}
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var voyages []model.Voyage
	err = cursor.All(ctx, &voyages)
	return voyages, err
}

func (r *VoyageRepository) CheckPersonnelConflict(ctx context.Context, personnelIDs []string, start, end time.Time, excludeID string) (map[string][]model.Voyage, error) {
	filter := bson.M{
		"passengers": bson.M{"$in": personnelIDs},
		"status": bson.M{
			"$in": []model.VoyageStatus{
				model.VoyageStatusApproved,
				model.VoyageStatusSailing,
			},
		},
		"$and": []bson.M{
			{"departure_time": bson.M{"$lt": end}},
			{"return_time": bson.M{"$gt": start}},
		},
	}
	if excludeID != "" {
		oid, err := primitive.ObjectIDFromHex(excludeID)
		if err == nil {
			filter["_id"] = bson.M{"$ne": oid}
		}
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var voyages []model.Voyage
	if err = cursor.All(ctx, &voyages); err != nil {
		return nil, err
	}

	result := make(map[string][]model.Voyage)
	for _, v := range voyages {
		for _, p := range v.Passengers {
			result[p] = append(result[p], v)
		}
	}
	return result, nil
}

func (r *VoyageRepository) InsertWeatherForecast(ctx context.Context, forecasts []model.WeatherForecast) error {
	if len(forecasts) == 0 {
		return nil
	}
	models := make([]mongo.WriteModel, len(forecasts))
	for i, f := range forecasts {
		models[i] = mongo.NewUpdateOneModel().
			SetFilter(bson.M{"wind_farm_id": f.WindFarmID, "timestamp": f.Timestamp}).
			SetUpdate(bson.M{"$set": f}).
			SetUpsert(true)
	}
	_, err := r.weatherFrcColl.BulkWrite(ctx, models)
	return err
}

func (r *VoyageRepository) GetWeatherForecast(ctx context.Context, windFarmID string, start, end time.Time) ([]model.WeatherForecast, error) {
	filter := bson.M{
		"wind_farm_id": windFarmID,
		"timestamp": bson.M{
			"$gte": start,
			"$lte": end,
		},
	}
	opts := options.Find().SetSort(bson.D{{Key: "timestamp", Value: 1}})

	cursor, err := r.weatherFrcColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var forecasts []model.WeatherForecast
	err = cursor.All(ctx, &forecasts)
	return forecasts, err
}

func (r *VoyageRepository) SaveWeatherWindows(ctx context.Context, windows []model.WeatherWindow) error {
	if len(windows) == 0 {
		return nil
	}
	docs := make([]interface{}, len(windows))
	for i := range windows {
		docs[i] = windows[i]
	}
	_, err := r.weatherWinColl.InsertMany(ctx, docs)
	return err
}

func (r *VoyageRepository) GetWeatherWindows(ctx context.Context, windFarmID string, start, end time.Time) ([]model.WeatherWindow, error) {
	filter := bson.M{
		"wind_farm_id": windFarmID,
		"feasible": true,
		"$and": []bson.M{
			{"start_time": bson.M{"$lt": end}},
			{"end_time": bson.M{"$gt": start}},
		},
	}
	opts := options.Find().SetSort(bson.D{{Key: "start_time", Value: 1}})

	cursor, err := r.weatherWinColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var windows []model.WeatherWindow
	err = cursor.All(ctx, &windows)
	return windows, err
}

func generateOrderNo(prefix string, t time.Time) string {
	return fmt.Sprintf("%s%s%06d", prefix, t.Format("20060102150405"), time.Now().UnixNano()%1000000)
}
