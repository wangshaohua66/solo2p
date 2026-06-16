package repository

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"offshore-wind-ops/internal/model"
)

type UserRepository struct {
	collection *mongo.Collection
}

func NewUserRepository(db *mongo.Database) *UserRepository {
	return &UserRepository{
		collection: db.Collection(CollectionUsers),
	}
}

func (r *UserRepository) Create(ctx context.Context, user *model.User) error {
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now
	result, err := r.collection.InsertOne(ctx, user)
	if err == nil {
		user.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *UserRepository) GetByID(ctx context.Context, id string) (*model.User, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var user model.User
	err = r.collection.FindOne(ctx, bson.M{"_id": oid}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*model.User, error) {
	var user model.User
	err := r.collection.FindOne(ctx, bson.M{"username": username}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) Update(ctx context.Context, user *model.User) error {
	user.UpdatedAt = time.Now()
	_, err := r.collection.UpdateOne(ctx,
		bson.M{"_id": user.ID},
		bson.M{"$set": user},
	)
	return err
}

func (r *UserRepository) List(ctx context.Context, filter bson.M, page, pageSize int) ([]model.User, int64, error) {
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

	var users []model.User
	if err = cursor.All(ctx, &users); err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

type TurbineRepository struct {
	collection  *mongo.Collection
	scadaColl   *mongo.Collection
	healthColl  *mongo.Collection
	configColl  *mongo.Collection
	windFarmColl *mongo.Collection
}

func NewTurbineRepository(db *mongo.Database) *TurbineRepository {
	return &TurbineRepository{
		collection:   db.Collection(CollectionTurbines),
		scadaColl:    db.Collection(CollectionSCADAData),
		healthColl:   db.Collection(CollectionHealthScores),
		configColl:   db.Collection(CollectionHealthConfigs),
		windFarmColl: db.Collection(CollectionWindFarms),
	}
}

func (r *TurbineRepository) CreateWindFarm(ctx context.Context, wf *model.WindFarm) error {
	now := time.Now()
	wf.CreatedAt = now
	wf.UpdatedAt = now
	result, err := r.windFarmColl.InsertOne(ctx, wf)
	if err == nil {
		wf.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *TurbineRepository) GetWindFarm(ctx context.Context, id string) (*model.WindFarm, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var wf model.WindFarm
	err = r.windFarmColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&wf)
	return &wf, err
}

func (r *TurbineRepository) ListWindFarms(ctx context.Context) ([]model.WindFarm, error) {
	cursor, err := r.windFarmColl.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var farms []model.WindFarm
	err = cursor.All(ctx, &farms)
	return farms, err
}

func (r *TurbineRepository) CreateTurbine(ctx context.Context, t *model.Turbine) error {
	now := time.Now()
	t.CreatedAt = now
	t.UpdatedAt = now
	t.HealthScore = 100
	t.Status = model.TurbineStatusNormal
	result, err := r.collection.InsertOne(ctx, t)
	if err == nil {
		t.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *TurbineRepository) GetTurbine(ctx context.Context, id string) (*model.Turbine, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var t model.Turbine
	err = r.collection.FindOne(ctx, bson.M{"_id": oid}).Decode(&t)
	return &t, err
}

func (r *TurbineRepository) GetTurbineByNo(ctx context.Context, no string) (*model.Turbine, error) {
	var t model.Turbine
	err := r.collection.FindOne(ctx, bson.M{"turbine_no": no}).Decode(&t)
	return &t, err
}

func (r *TurbineRepository) ListTurbines(ctx context.Context, filter bson.M, page, pageSize int) ([]model.Turbine, int64, error) {
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "turbine_no", Value: 1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var turbines []model.Turbine
	if err = cursor.All(ctx, &turbines); err != nil {
		return nil, 0, err
	}
	return turbines, total, nil
}

func (r *TurbineRepository) UpdateTurbine(ctx context.Context, t *model.Turbine) error {
	t.UpdatedAt = time.Now()
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": t.ID}, bson.M{"$set": t})
	return err
}

func (r *TurbineRepository) UpdateHealthScore(ctx context.Context, turbineID string, score float64, status model.TurbineStatus) error {
	now := time.Now()
	_, err := r.collection.UpdateOne(ctx,
		bson.M{"_id": turbineID},
		bson.M{"$set": bson.M{
			"health_score":      score,
			"status":            status,
			"last_health_check": now,
			"updated_at":        now,
		}},
	)
	return err
}

func (r *TurbineRepository) InsertSCADAData(ctx context.Context, data *model.SCADAData) error {
	_, err := r.scadaColl.InsertOne(ctx, data)
	return err
}

func (r *TurbineRepository) InsertSCADABatch(ctx context.Context, data []model.SCADAData) error {
	if len(data) == 0 {
		return nil
	}
	docs := make([]interface{}, len(data))
	for i := range data {
		docs[i] = data[i]
	}
	_, err := r.scadaColl.InsertMany(ctx, docs)
	return err
}

func (r *TurbineRepository) GetLatestSCADA(ctx context.Context, turbineID string, limit int) ([]model.SCADAData, error) {
	opts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetLimit(int64(limit))

	cursor, err := r.scadaColl.Find(ctx, bson.M{"turbine_id": turbineID}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var data []model.SCADAData
	err = cursor.All(ctx, &data)
	return data, err
}

func (r *TurbineRepository) GetSCADAByTimeRange(ctx context.Context, turbineID string, start, end time.Time) ([]model.SCADAData, error) {
	filter := bson.M{
		"turbine_id": turbineID,
		"timestamp": bson.M{
			"$gte": start,
			"$lte": end,
		},
	}
	opts := options.Find().SetSort(bson.D{{Key: "timestamp", Value: 1}})

	cursor, err := r.scadaColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var data []model.SCADAData
	err = cursor.All(ctx, &data)
	return data, err
}

func (r *TurbineRepository) InsertHealthRecord(ctx context.Context, record *model.HealthRecord) error {
	_, err := r.healthColl.InsertOne(ctx, record)
	return err
}

func (r *TurbineRepository) GetRecentHealthRecords(ctx context.Context, turbineID string, limit int) ([]model.HealthRecord, error) {
	opts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetLimit(int64(limit))

	cursor, err := r.healthColl.Find(ctx, bson.M{"turbine_id": turbineID}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var records []model.HealthRecord
	err = cursor.All(ctx, &records)
	return records, err
}

func (r *TurbineRepository) GetHealthConfig(ctx context.Context, turbineModel model.TurbineModel) (*model.HealthScoreConfig, error) {
	var config model.HealthScoreConfig
	err := r.configColl.FindOne(ctx, bson.M{"turbine_model": turbineModel}).Decode(&config)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	return &config, err
}

func (r *TurbineRepository) UpsertHealthConfig(ctx context.Context, config *model.HealthScoreConfig) error {
	now := time.Now()
	config.UpdatedAt = now

	filter := bson.M{"turbine_model": config.TurbineModel}
	update := bson.M{
		"$set": bson.M{
			"weights":            config.Weights,
			"thresholds":         config.Thresholds,
			"warning_score":      config.WarningScore,
			"fault_score":        config.FaultScore,
			"consecutive_periods": config.ConsecutivePeriods,
			"updated_by":         config.UpdatedBy,
			"updated_at":         now,
		},
		"$setOnInsert": bson.M{
			"created_at": now,
		},
	}

	opts := options.Update().SetUpsert(true)
	_, err := r.configColl.UpdateOne(ctx, filter, update, opts)
	return err
}

func (r *TurbineRepository) ListHealthConfigs(ctx context.Context) ([]model.HealthScoreConfig, error) {
	cursor, err := r.configColl.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var configs []model.HealthScoreConfig
	err = cursor.All(ctx, &configs)
	return configs, err
}

func (r *TurbineRepository) GetHealthOverview(ctx context.Context, windFarmID string) ([]model.HealthOverview, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"wind_farm_id": windFarmID}}},
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

	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []model.HealthOverview
	err = cursor.All(ctx, &results)
	return results, err
}
