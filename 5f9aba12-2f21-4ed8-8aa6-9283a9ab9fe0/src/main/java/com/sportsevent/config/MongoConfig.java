package com.sportsevent.config;

import com.mongodb.ReadPreference;
import com.mongodb.ServerAddress;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.util.ArrayList;
import java.util.List;

@Configuration
@EnableMongoAuditing
public class MongoConfig {

    @Value("${spring.data.mongodb.uri:mongodb://localhost:27017/sports_event}")
    private String mongoUri;

    @Value("${spring.data.mongodb.database:sports_event}")
    private String databaseName;

    @Value("${spring.data.mongodb.replica-set:}")
    private String replicaSetName;

    @Bean
    public MongoTransactionManager transactionManager(MongoDatabaseFactory dbFactory) {
        return new MongoTransactionManager(dbFactory);
    }

    @Bean
    public MongoCustomConversions mongoCustomConversions() {
        List<Object> converters = new ArrayList<>();
        return new MongoCustomConversions(converters);
    }

    @Bean
    @Primary
    public MongoTemplate mongoTemplate(MongoDatabaseFactory mongoDatabaseFactory) {
        return new MongoTemplate(mongoDatabaseFactory);
    }

    @Bean(name = "secondaryMongoTemplate")
    public MongoTemplate secondaryMongoTemplate() {
        MongoClient secondaryClient = MongoClients.create(mongoUri);
        SimpleMongoClientDatabaseFactory factory =
                new SimpleMongoClientDatabaseFactory(secondaryClient, databaseName);

        MongoTemplate template = new MongoTemplate(factory);
        template.getMongoDatabase().withReadPreference(ReadPreference.secondaryPreferred());
        return template;
    }

    @Bean
    public MongoDatabaseFactory mongoDatabaseFactory(MongoClient mongoClient) {
        return new SimpleMongoClientDatabaseFactory(mongoClient, databaseName);
    }

    @Bean
    public MongoClient mongoClient() {
        return MongoClients.create(mongoUri);
    }
}
