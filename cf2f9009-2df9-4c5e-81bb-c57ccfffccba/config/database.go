package config

import (
	"context"
	"log"

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
