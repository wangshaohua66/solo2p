package config

import (
	"context"
	"log"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Database struct {
	Client   *mongo.Client
	Database *mongo.Database
}

var DB *Database

func InitDB(cfg *DatabaseConfig) error {
	client, err := mongo.Connect(options.Client().ApplyURI(cfg.URI))
	if err != nil {
		return err
	}

	if err := client.Ping(context.TODO(), nil); err != nil {
		return err
	}

	DB = &Database{
		Client:   client,
		Database: client.Database(cfg.Database),
	}

	log.Println("MongoDB connected successfully")

	if err := InitIndexes(); err != nil {
		log.Printf("Warning: failed to initialize indexes: %v", err)
	}

	return nil
}

func InitIndexes() error {
	ctx := context.Background()

	trackCol := DB.Collection(ColTrackPoints)
	_, err := trackCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "vessel_id", Value: 1}, {Key: "timestamp", Value: -1}},
		Options: options.Index().SetName("vessel_id_timestamp"),
	})
	if err != nil {
		log.Printf("Failed to create track index: %v", err)
	}

	_, err = trackCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "location", Value: "2dsphere"}},
		Options: options.Index().SetName("location_2dsphere"),
	})
	if err != nil {
		log.Printf("Failed to create track location index: %v", err)
	}

	catchCol := DB.Collection(ColCatchRecords)
	_, err = catchCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "location", Value: "2dsphere"}},
		Options: options.Index().SetName("catch_location_2dsphere"),
	})
	if err != nil {
		log.Printf("Failed to create catch location index: %v", err)
	}

	_, err = catchCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{
			{Key: "vessel_id", Value: 1},
			{Key: "species_code", Value: 1},
			{Key: "catch_time", Value: -1},
		},
		Options: options.Index().SetName("vessel_species_catchtime"),
	})
	if err != nil {
		log.Printf("Failed to create catch composite index: %v", err)
	}

	supplyCol := DB.Collection(ColSupplyPoints)
	_, err = supplyCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "location", Value: "2dsphere"}},
		Options: options.Index().SetName("supply_location_2dsphere"),
	})
	if err != nil {
		log.Printf("Failed to create supply location index: %v", err)
	}

	forbiddenCol := DB.Collection(ColForbiddenZones)
	_, err = forbiddenCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "boundary", Value: "2dsphere"}},
		Options: options.Index().SetName("boundary_2dsphere"),
	})
	if err != nil {
		log.Printf("Failed to create forbidden boundary index: %v", err)
	}

	vesselQuotaCol := DB.Collection(ColVesselQuotas)
	_, err = vesselQuotaCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{
			{Key: "vessel_id", Value: 1},
			{Key: "year", Value: 1},
			{Key: "species_code", Value: 1},
		},
		Options: options.Index().SetName("vessel_year_species").SetUnique(true),
	})
	if err != nil {
		log.Printf("Failed to create vessel quota index: %v", err)
	}

	tradeCol := DB.Collection(ColSeaTrades)
	_, err = tradeCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{
			{Key: "settlement_month", Value: 1},
			{Key: "status", Value: 1},
		},
		Options: options.Index().SetName("settlement_month_status"),
	})
	if err != nil {
		log.Printf("Failed to create trade index: %v", err)
	}

	yawAlertCol := DB.Collection(ColYawAlerts)
	_, err = yawAlertCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "vessel_id", Value: 1}, {Key: "alert_time", Value: -1}},
		Options: options.Index().SetName("vessel_alert_time"),
	})
	if err != nil {
		log.Printf("Failed to create yaw alert index: %v", err)
	}

	violationCol := DB.Collection(ColForbiddenViolations)
	_, err = violationCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{
			{Key: "vessel_id", Value: 1},
			{Key: "status", Value: 1},
		},
		Options: options.Index().SetName("vessel_violation_status"),
	})
	if err != nil {
		log.Printf("Failed to create violation index: %v", err)
	}

	log.Println("MongoDB indexes initialized successfully")
	return nil
}

func (d *Database) Collection(name string) *mongo.Collection {
	return d.Database.Collection(name)
}

func (d *Database) Close() error {
	if d.Client != nil {
		return d.Client.Disconnect(context.TODO())
	}
	return nil
}

const (
	ColVessels            = "vessels"
	ColTrackPoints        = "track_points"
	ColYawAlerts          = "yaw_alerts"
	ColCatchRecords       = "catch_records"
	ColAnnualQuotas       = "annual_quotas"
	ColVesselQuotas       = "vessel_quotas"
	ColQuotaTransfers     = "quota_transfers"
	ColSeaTrades          = "sea_trades"
	ColMonthlySettlements = "monthly_settlements"
	ColTradeDisputes      = "trade_disputes"
	ColFuelRecords        = "fuel_records"
	ColSupplyPoints       = "supply_points"
	ColFuelSupplyPlans    = "fuel_supply_plans"
	ColForbiddenZones     = "forbidden_zones"
	ColForbiddenViolations = "forbidden_violations"
)
