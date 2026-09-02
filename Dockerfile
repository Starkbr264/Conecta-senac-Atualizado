# ---------- ETAPA 1: BUILD ----------
FROM gradle:jdk21 AS build

WORKDIR /app

COPY ["demo-conecta-senac3.1(backend)/demo/build.gradle", "./"]
COPY ["demo-conecta-senac3.1(backend)/demo/settings.gradle", "./"]
COPY ["demo-conecta-senac3.1(backend)/demo/src", "./src"]

RUN gradle clean bootJar -x test --no-daemon

RUN find /app/build/libs -type f -name "*.jar" ! -name "*-plain.jar" -exec cp {} /app/app.jar \;


# ---------- ETAPA 2: RUNTIME ----------
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=build /app/app.jar app.jar

ENTRYPOINT ["java", "-jar", "app.jar"]