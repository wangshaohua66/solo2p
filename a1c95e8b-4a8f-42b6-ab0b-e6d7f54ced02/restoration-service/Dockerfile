FROM maven:3.9.6-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B || true
COPY restoration-service/pom.xml ./restoration-service/
COPY eureka-server/pom.xml ./eureka-server/
COPY gateway-service/pom.xml ./gateway-service/
COPY auth-service/pom.xml ./auth-service/
COPY artifact-service/pom.xml ./artifact-service/
COPY trace-service/pom.xml ./trace-service/
COPY collab-service/pom.xml ./collab-service/
COPY inspect-service/pom.xml ./inspect-service/
COPY restoration-service/src ./restoration-service/src
RUN mvn clean package -pl restoration-service -am -DskipTests -B

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring
COPY --from=builder /app/restoration-service/target/*.jar app.jar
EXPOSE 9600
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+UseG1GC"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
