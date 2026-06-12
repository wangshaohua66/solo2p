package com.carbon.common.config;

import com.carbon.common.context.UserContextHolder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.lang.NonNull;

@Slf4j
public class TenantRoutingMongoDatabaseFactory extends SimpleMongoClientDatabaseFactory {

    private final com.mongodb.client.MongoClient mongoClient;
    private final String defaultDatabaseName;
    private final String databasePrefix;

    public TenantRoutingMongoDatabaseFactory(com.mongodb.client.MongoClient mongoClient,
                                             String databaseName,
                                             String databasePrefix) {
        super(mongoClient, databaseName);
        this.mongoClient = mongoClient;
        this.defaultDatabaseName = databaseName;
        this.databasePrefix = databasePrefix;
    }

    @Override
    @NonNull
    protected com.mongodb.client.MongoDatabase doGetMongoDatabase(String name) {
        String tenantId = UserContextHolder.getTenantIdSafe();
        String dbName;
        if (tenantId != null && !tenantId.isEmpty() && !defaultDatabaseName.equals(name)) {
            dbName = databasePrefix + tenantId + "_" + name;
        } else if (tenantId != null && !tenantId.isEmpty()) {
            dbName = databasePrefix + tenantId;
        } else {
            dbName = name;
        }
        return mongoClient.getDatabase(dbName);
    }
}
