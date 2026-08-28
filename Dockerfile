# ---------- ETAPA 1: BUILD ----------
FROM gradle:jdk21 AS build

WORKDIR /app

# Copia os arquivos do backend que estão dentro do repositório
COPY ["demo-conecta-senac3.1(backend)/demo/build.gradle", "./"]
COPY ["demo-conecta-senac3.1(backend)/demo/settings.gradle", "./"]

# Copia o código-fonte do backend
COPY ["demo-conecta-senac3.1(backend)/demo/src", "./src"]

# Gera o JAR executável do Spring Boot
RUN gradle clean bootJar -x test --no-daemon

# Remove qualquer JAR "plain" e deixa o executável com nome fixo
RUN find /app/build/libs -type f -name "*.jar" ! -name "*-plain.jar" -exec cp {} /app/app.jar \;


# ---------- ETAPA 2: RUNTIME ----------
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=build /app/app.jar app.jar

ENTRYPOINT ["java", "-jar", "app.jar"]