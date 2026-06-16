package repository

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"

	"offshore-wind-ops/internal/model"
)

const (
	CollectionUsers          = "users"
	CollectionWindFarms      = "wind_farms"
	CollectionTurbines       = "turbines"
	CollectionSCADAData      = "scada_data"
	CollectionHealthScores   = "health_records"
	CollectionHealthConfigs  = "health_configs"
	CollectionWorkOrders     = "work_orders"
	CollectionInspectionReports = "inspection_reports"
	CollectionShips          = "ships"
	CollectionVoyages        = "voyages"
	CollectionWeatherWindows = "weather_windows"
	CollectionWeatherForecasts = "weather_forecasts"
	CollectionPersonnel      = "personnel"
	CollectionEvacuations    = "evacuations"
	CollectionCertAlerts     = "cert_alerts"
	CollectionSpareParts     = "spare_parts"
	CollectionInventory      = "inventory"
	CollectionWarehouses     = "warehouses"
	CollectionTransfers      = "transfers"
	CollectionRestockOrders  = "restock_orders"
	CollectionInventoryAlerts = "inventory_alerts"
	CollectionAlerts         = "alerts"
	CollectionRefreshTokens  = "refresh_tokens"
)

type MongoClient struct {
	client   *mongo.Client
	database *mongo.Database
	config   *model.MongoDBConfig
}

func NewMongoClient(cfg *model.MongoDBConfig) (*MongoClient, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(cfg.ConnectTimeout)*time.Second)
	defer cancel()

	clientOpts := options.Client().
		ApplyURI(cfg.URI).
		SetMaxPoolSize(cfg.MaxPoolSize).
		SetMinPoolSize(cfg.MinPoolSize).
		SetServerSelectionTimeout(5 * time.Second)

	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to mongodb: %w", err)
	}

	if err = client.Ping(ctx, readpref.Primary()); err != nil {
		return nil, fmt.Errorf("failed to ping mongodb: %w", err)
	}

	db := client.Database(cfg.Database)

	mc := &MongoClient{
		client:   client,
		database: db,
		config:   cfg,
	}

	if err := mc.ensureIndexes(ctx); err != nil {
		return nil, fmt.Errorf("failed to ensure indexes: %w", err)
	}

	return mc, nil
}

func (m *MongoClient) GetDatabase() *mongo.Database {
	return m.database
}

func (m *MongoClient) GetCollection(name string) *mongo.Collection {
	return m.database.Collection(name)
}

func (m *MongoClient) Close(ctx context.Context) error {
	return m.client.Disconnect(ctx)
}

func (m *MongoClient) ensureIndexes(ctx context.Context) error {
	indexModels := map[string][]mongo.IndexModel{
		CollectionUsers: {
			{Keys: bson.D{{Key: "username", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "role", Value: 1}}},
		},
		CollectionTurbines: {
			{Keys: bson.D{{Key: "turbine_no", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "wind_farm_id", Value: 1}}},
			{Keys: bson.D{{Key: "status", Value: 1}}},
			{Keys: bson.D{{Key: "health_score", Value: 1}}},
		},
		CollectionSCADAData: {
			{Keys: bson.D{{Key: "turbine_id", Value: 1}, {Key: "timestamp", Value: -1}}},
			{Keys: bson.D{{Key: "timestamp", Value: -1}}},
		},
		CollectionHealthScores: {
			{Keys: bson.D{{Key: "turbine_id", Value: 1}, {Key: "timestamp", Value: -1}}},
			{Keys: bson.D{{Key: "status", Value: 1}}},
		},
		CollectionWorkOrders: {
			{Keys: bson.D{{Key: "order_no", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "turbine_id", Value: 1}}},
			{Keys: bson.D{{Key: "wind_farm_id", Value: 1}}},
			{Keys: bson.D{{Key: "status", Value: 1}}},
			{Keys: bson.D{{Key: "assigned_to", Value: 1}}},
			{Keys: bson.D{{Key: "created_at", Value: -1}}},
		},
		CollectionVoyages: {
			{Keys: bson.D{{Key: "voyage_no", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "ship_id", Value: 1}, {Key: "departure_time", Value: 1}}},
			{Keys: bson.D{{Key: "wind_farm_id", Value: 1}}},
			{Keys: bson.D{{Key: "status", Value: 1}}},
			{Keys: bson.D{{Key: "departure_time", Value: 1}, {Key: "return_time", Value: 1}}},
		},
		CollectionShips: {
			{Keys: bson.D{{Key: "ship_no", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "status", Value: 1}}},
		},
		CollectionWeatherForecasts: {
			{Keys: bson.D{{Key: "wind_farm_id", Value: 1}, {Key: "timestamp", Value: 1}}, Options: options.Index().SetUnique(true)},
		},
		CollectionWeatherWindows: {
			{Keys: bson.D{{Key: "wind_farm_id", Value: 1}, {Key: "start_time", Value: 1}}},
		},
		CollectionPersonnel: {
			{Keys: bson.D{{Key: "employee_no", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "status", Value: 1}}},
			{Keys: bson.D{{Key: "current_voyage_id", Value: 1}}},
		},
		CollectionEvacuations: {
			{Keys: bson.D{{Key: "order_no", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "wind_farm_id", Value: 1}}},
			{Keys: bson.D{{Key: "status", Value: 1}}},
			{Keys: bson.D{{Key: "created_at", Value: -1}}},
		},
		CollectionInventory: {
			{Keys: bson.D{{Key: "part_id", Value: 1}, {Key: "warehouse_id", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "warehouse_id", Value: 1}}},
			{Keys: bson.D{{Key: "available_qty", Value: 1}}},
		},
		CollectionTransfers: {
			{Keys: bson.D{{Key: "transfer_no", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "status", Value: 1}}},
			{Keys: bson.D{{Key: "source_warehouse_id", Value: 1}}},
			{Keys: bson.D{{Key: "target_warehouse_id", Value: 1}}},
		},
		CollectionAlerts: {
			{Keys: bson.D{{Key: "alert_no", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "type", Value: 1}}},
			{Keys: bson.D{{Key: "severity", Value: 1}}},
			{Keys: bson.D{{Key: "status", Value: 1}}},
			{Keys: bson.D{{Key: "wind_farm_id", Value: 1}}},
			{Keys: bson.D{{Key: "created_at", Value: -1}}},
		},
		CollectionRefreshTokens: {
			{Keys: bson.D{{Key: "token", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "user_id", Value: 1}}},
			{Keys: bson.D{{Key: "expires_at", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
		},
	}

	for collName, models := range indexModels {
		coll := m.database.Collection(collName)
		if _, err := coll.Indexes().CreateMany(ctx, models); err != nil {
			return fmt.Errorf("failed to create indexes for %s: %w", collName, err)
		}
	}

	return nil
}
