package search

import (
	"bytes"
	"context"
	"encoding/json"
	"equipment-trading-platform/internal/config"
	"equipment-trading-platform/pkg/logger"
	"fmt"
	"strings"
	"time"

	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"
)

var Client *elasticsearch.Client
var defaultIndex string

func Init(cfg *config.ElasticsearchConfig) error {
	cfgES := elasticsearch.Config{
		Addresses: cfg.Addresses,
		Username:  cfg.Username,
		Password:  cfg.Password,
	}

	var err error
	Client, err = elasticsearch.NewClient(cfgES)
	if err != nil {
		return fmt.Errorf("create elasticsearch client failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res, err := Client.Ping(Client.Ping.WithContext(ctx))
	if err != nil {
		Client = nil
		return fmt.Errorf("elasticsearch ping failed: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		Client = nil
		return fmt.Errorf("elasticsearch ping returned error: %s", res.Status())
	}

	defaultIndex = cfg.Index

	if err := ensureIndex(); err != nil {
		logger.Warnf("ensure elasticsearch index failed: %v", err)
	}

	logger.Info("elasticsearch initialized successfully")
	return nil
}

func ensureIndex() error {
	if Client == nil {
		return nil
	}

	mapping := `{
		"settings": {
			"number_of_shards": 3,
			"number_of_replicas": 1
		},
		"mappings": {
			"properties": {
				"id":            {"type": "long"},
				"category_id":   {"type": "integer"},
				"category_name": {"type": "keyword"},
				"brand":         {"type": "keyword"},
				"model":         {"type": "text"},
				"title":         {"type": "text"},
				"description":   {"type": "text"},
				"region":        {"type": "keyword"},
				"status":        {"type": "keyword"},
				"price":         {"type": "double"},
				"valuation_price": {"type": "double"},
				"manufacture_year": {"type": "integer"},
				"work_hours":    {"type": "double"},
				"seller_id":     {"type": "long"},
				"created_at":    {"type": "date"}
			}
		}
	}`

	req := esapi.IndicesExistsRequest{Index: []string{defaultIndex}}
	res, err := req.Do(context.Background(), Client)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode == 404 {
		createReq := esapi.IndicesCreateRequest{
			Index: defaultIndex,
			Body:  strings.NewReader(mapping),
		}
		createRes, err := createReq.Do(context.Background(), Client)
		if err != nil {
			return err
		}
		defer createRes.Body.Close()
		if createRes.IsError() {
			return fmt.Errorf("create index failed: %s", createRes.Status())
		}
	}
	return nil
}

type DeviceDoc struct {
	ID              uint64  `json:"id"`
	CategoryID      uint64  `json:"category_id"`
	CategoryName    string  `json:"category_name"`
	Brand           string  `json:"brand"`
	Model           string  `json:"model"`
	Title           string  `json:"title"`
	Description     string  `json:"description"`
	Region          string  `json:"region"`
	Status          string  `json:"status"`
	Price           float64 `json:"price"`
	ValuationPrice  float64 `json:"valuation_price"`
	ManufactureYear int     `json:"manufacture_year"`
	WorkHours       float64 `json:"work_hours"`
	SellerID        uint64  `json:"seller_id"`
}

type SearchQuery struct {
	Keyword    string
	CategoryID *uint64
	Brand      string
	Model      string
	Region     string
	Status     string
	MinPrice   *float64
	MaxPrice   *float64
	MinYear    *int
	MaxYear    *int
	Page       int
	PageSize   int
}

type SearchResult struct {
	IDs   []uint64
	Total int64
}

func IndexDevice(doc *DeviceDoc) error {
	if Client == nil {
		return nil
	}
	body, _ := json.Marshal(doc)
	req := esapi.IndexRequest{
		Index:      defaultIndex,
		DocumentID: fmt.Sprintf("%d", doc.ID),
		Body:       bytes.NewReader(body),
		Refresh:    "true",
	}
	res, err := req.Do(context.Background(), Client)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.IsError() {
		return fmt.Errorf("index document failed: %s", res.Status())
	}
	return nil
}

func UpdateDevice(doc *DeviceDoc) error {
	return IndexDevice(doc)
}

func DeleteDevice(id uint64) error {
	if Client == nil {
		return nil
	}
	req := esapi.DeleteRequest{
		Index:      defaultIndex,
		DocumentID: fmt.Sprintf("%d", id),
		Refresh:    "true",
	}
	res, err := req.Do(context.Background(), Client)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.IsError() && res.StatusCode != 404 {
		return fmt.Errorf("delete document failed: %s", res.Status())
	}
	return nil
}

func SearchDevices(q *SearchQuery) (*SearchResult, error) {
	result := &SearchResult{IDs: []uint64{}, Total: 0}
	if Client == nil {
		return result, nil
	}

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PageSize <= 0 {
		q.PageSize = 20
	}

	query := map[string]interface{}{
		"query": map[string]interface{}{
			"bool": map[string]interface{}{
				"must":   []interface{}{},
				"filter": []interface{}{},
			},
		},
		"from": (q.Page - 1) * q.PageSize,
		"size": q.PageSize,
		"sort": []interface{}{
			map[string]interface{}{"created_at": map[string]string{"order": "desc"}},
		},
	}

	boolQuery := query["query"].(map[string]interface{})["bool"].(map[string]interface{})
	must := boolQuery["must"].([]interface{})
	filter := boolQuery["filter"].([]interface{})

	if q.Keyword != "" {
		must = append(must, map[string]interface{}{
			"multi_match": map[string]interface{}{
				"query":  q.Keyword,
				"fields": []string{"title", "description", "model", "brand"},
			},
		})
	}
	if q.CategoryID != nil {
		filter = append(filter, map[string]interface{}{"term": map[string]interface{}{"category_id": *q.CategoryID}})
	}
	if q.Brand != "" {
		filter = append(filter, map[string]interface{}{"term": map[string]interface{}{"brand": q.Brand}})
	}
	if q.Region != "" {
		filter = append(filter, map[string]interface{}{"term": map[string]interface{}{"region": q.Region}})
	}
	if q.Status != "" {
		filter = append(filter, map[string]interface{}{"term": map[string]interface{}{"status": q.Status}})
	}
	if q.MinPrice != nil || q.MaxPrice != nil {
		rangeQ := map[string]interface{}{}
		if q.MinPrice != nil {
			rangeQ["gte"] = *q.MinPrice
		}
		if q.MaxPrice != nil {
			rangeQ["lte"] = *q.MaxPrice
		}
		filter = append(filter, map[string]interface{}{"range": map[string]interface{}{"price": rangeQ}})
	}
	if q.MinYear != nil || q.MaxYear != nil {
		rangeQ := map[string]interface{}{}
		if q.MinYear != nil {
			rangeQ["gte"] = *q.MinYear
		}
		if q.MaxYear != nil {
			rangeQ["lte"] = *q.MaxYear
		}
		filter = append(filter, map[string]interface{}{"range": map[string]interface{}{"manufacture_year": rangeQ}})
	}

	boolQuery["must"] = must
	boolQuery["filter"] = filter

	body, _ := json.Marshal(query)
	req := esapi.SearchRequest{
		Index: []string{defaultIndex},
		Body:  bytes.NewReader(body),
	}
	res, err := req.Do(context.Background(), Client)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.IsError() {
		return nil, fmt.Errorf("search failed: %s", res.Status())
	}

	var esResp struct {
		Hits struct {
			Total struct {
				Value int64 `json:"value"`
			} `json:"total"`
			Hits []struct {
				ID     string          `json:"_id"`
				Source json.RawMessage `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(res.Body).Decode(&esResp); err != nil {
		return nil, err
	}

	result.Total = esResp.Hits.Total.Value
	for _, h := range esResp.Hits.Hits {
		var doc DeviceDoc
		if err := json.Unmarshal(h.Source, &doc); err == nil {
			result.IDs = append(result.IDs, doc.ID)
		}
	}
	return result, nil
}
