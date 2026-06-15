package com.ems.dispatch.config

import graphql.GraphQLContext
import graphql.execution.CoercedVariables
import graphql.language.StringValue
import graphql.language.Value
import graphql.schema.Coercing
import graphql.schema.CoercingParseLiteralException
import graphql.schema.CoercingParseValueException
import graphql.schema.CoercingSerializeException
import graphql.schema.GraphQLScalarType
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Configuration
class GraphQLScalarConfig {

    private val dateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME

    @Bean
    fun dateTimeScalar(): GraphQLScalarType {
        return GraphQLScalarType.newScalar()
            .name("DateTime")
            .description("DateTime scalar in ISO-8601 format")
            .coercing(object : Coercing<LocalDateTime, String> {
                override fun serialize(
                    dataFetcherResult: Any,
                    graphQLContext: GraphQLContext,
                    locale: java.util.Locale
                ): String {
                    return when (dataFetcherResult) {
                        is LocalDateTime -> dataFetcherResult.format(dateTimeFormatter)
                        is String -> dataFetcherResult
                        else -> throw CoercingSerializeException(
                            "Expected LocalDateTime or String but was " + dataFetcherResult.javaClass.simpleName
                        )
                    }
                }

                override fun parseValue(
                    input: Any,
                    graphQLContext: GraphQLContext,
                    locale: java.util.Locale
                ): LocalDateTime {
                    return when (input) {
                        is String -> try {
                            LocalDateTime.parse(input, dateTimeFormatter)
                        } catch (e: Exception) {
                            throw CoercingParseValueException("Invalid DateTime format: $input", e)
                        }
                        is LocalDateTime -> input
                        else -> throw CoercingParseValueException(
                            "Expected String or LocalDateTime but was " + input.javaClass.simpleName
                        )
                    }
                }

                override fun parseLiteral(
                    input: Value<*>,
                    variables: CoercedVariables,
                    graphQLContext: GraphQLContext,
                    locale: java.util.Locale
                ): LocalDateTime {
                    if (input !is StringValue) {
                        throw CoercingParseLiteralException("Expected AST type 'StringValue' but was " + input.javaClass.simpleName)
                    }
                    return try {
                        LocalDateTime.parse(input.value, dateTimeFormatter)
                    } catch (e: Exception) {
                        throw CoercingParseLiteralException("Invalid DateTime format: ${input.value}", e)
                    }
                }
            })
            .build()
    }

    @Bean
    fun longScalar(): GraphQLScalarType {
        return GraphQLScalarType.newScalar()
            .name("Long")
            .description("Long scalar type")
            .coercing(object : Coercing<Long, Long> {
                override fun serialize(dataFetcherResult: Any, graphQLContext: GraphQLContext, locale: java.util.Locale): Long {
                    return when (dataFetcherResult) {
                        is Long -> dataFetcherResult
                        is Int -> dataFetcherResult.toLong()
                        is String -> dataFetcherResult.toLong()
                        else -> throw CoercingSerializeException(
                            "Expected Long but was " + dataFetcherResult.javaClass.simpleName
                        )
                    }
                }

                override fun parseValue(input: Any, graphQLContext: GraphQLContext, locale: java.util.Locale): Long {
                    return when (input) {
                        is Long -> input
                        is Int -> input.toLong()
                        is String -> input.toLong()
                        else -> throw CoercingParseValueException(
                            "Expected Long but was " + input.javaClass.simpleName
                        )
                    }
                }

                override fun parseLiteral(
                    input: Value<*>, variables: CoercedVariables,
                    graphQLContext: GraphQLContext, locale: java.util.Locale
                ): Long {
                    if (input !is graphql.language.IntValue) {
                        throw CoercingParseLiteralException("Expected AST type 'IntValue' but was " + input.javaClass.simpleName)
                    }
                    return input.value.toLong()
                }
            })
            .build()
    }

    @Bean
    fun doubleScalar(): GraphQLScalarType {
        return GraphQLScalarType.newScalar()
            .name("Double")
            .description("Double scalar type")
            .coercing(object : Coercing<Double, Double> {
                override fun serialize(dataFetcherResult: Any, graphQLContext: GraphQLContext, locale: java.util.Locale): Double {
                    return when (dataFetcherResult) {
                        is Double -> dataFetcherResult
                        is Float -> dataFetcherResult.toDouble()
                        is Int -> dataFetcherResult.toDouble()
                        is Long -> dataFetcherResult.toDouble()
                        is String -> dataFetcherResult.toDouble()
                        else -> throw CoercingSerializeException(
                            "Expected Double but was " + dataFetcherResult.javaClass.simpleName
                        )
                    }
                }

                override fun parseValue(input: Any, graphQLContext: GraphQLContext, locale: java.util.Locale): Double {
                    return when (input) {
                        is Double -> input
                        is Float -> input.toDouble()
                        is Int -> input.toDouble()
                        is Long -> input.toDouble()
                        is String -> input.toDouble()
                        else -> throw CoercingParseValueException(
                            "Expected Double but was " + input.javaClass.simpleName
                        )
                    }
                }

                override fun parseLiteral(
                    input: Value<*>, variables: CoercedVariables,
                    graphQLContext: GraphQLContext, locale: java.util.Locale
                ): Double {
                    return when (input) {
                        is graphql.language.IntValue -> input.value.toDouble()
                        is graphql.language.FloatValue -> input.value.toDouble()
                        else -> throw CoercingParseLiteralException(
                            "Expected AST type 'IntValue' or 'FloatValue' but was " + input.javaClass.simpleName
                        )
                    }
                }
            })
            .build()
    }
}
