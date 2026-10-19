# ==========================================================================
#  Backend Spring Boot — imagem de runtime.
#
#  Como usar (a partir da raiz do repositorio, onde fica o build Gradle):
#    docker build -f backend/demo/Dockerfile -t conecta-api ./backend/demo
#    docker run --rm -p 8081:8081 --env-file .env conecta-api
#
#  O build e feito em dois estagios para que a imagem final nao contenha nem
#  o JDK nem as fontes — so o jar e um JRE enxuto.
# ==========================================================================

FROM gradle:jdk21 AS build
WORKDIR /build

# Manifestos primeiro: a camada de dependencias fica em cache no Docker.
COPY build.gradle settings.gradle ./
COPY src ./src

RUN gradle --no-daemon --console=plain clean bootJar -x test \
 && cp "$(find build/libs -maxdepth 1 -name '*.jar' ! -name '*-plain.jar' | head -n 1)" /build/app.jar

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=build /build/app.jar /app/app.jar

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+UseSerialGC" \
    PORT=8081

EXPOSE 8081

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
