# Build stage
FROM eclipse-temurin:20-jdk AS builder
WORKDIR /app
COPY demo-conecta-senac3.1 .
COPY demo-conecta-senac3.1 ./gradle
COPY demo-conecta-senac3.1 settings.gradle ./
COPY demo-conecta-senac3.1 ./src
RUN ./gradlew bootJar --no-daemon

# Runtime stage
FROM eclipse-temurin:20-jre
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
