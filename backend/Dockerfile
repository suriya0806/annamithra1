# ==============================================================================
# Multi-stage Dockerfile for Annamithra Spring Boot Backend
# Optimized for Render deployment with Eclipse Temurin JDK/JRE 17
# ==============================================================================

# Stage 1: Build the application using Maven and JDK 17
FROM maven:3.9.9-eclipse-temurin-17-alpine AS builder

WORKDIR /build

# Cache Maven dependencies layer
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Copy application source code and package the Spring Boot executable JAR
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Production runtime image with lightweight JRE 17
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Create a non-root system group and user for container security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the built Spring Boot JAR from builder stage
COPY --from=builder /build/target/annamithra-api-*.jar app.jar

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

USER appuser

# Default port for local testing; Render injects its own $PORT dynamically
ENV PORT=8080
EXPOSE ${PORT}

# Production JVM options: Container-aware memory allocation and faster startup
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

# Start the Spring Boot application (exec replaces shell to ensure SIGTERM signal propagation)
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
