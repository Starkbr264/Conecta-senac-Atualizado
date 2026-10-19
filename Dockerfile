# syntax=docker/dockerfile:1

# ==========================================================================
#  Conecta-Senac - imagem unica: API Spring Boot servindo tambem o frontend.
#
#  Build (SEMPRE a partir da RAIZ do repositorio):
#    docker build -t conectasenac .
#
#  Run:
#    docker run --rm -p 8081:8081 --env-file .env conectasenac
#
#  Por que o frontend entra dentro do jar:
#    backend/demo/src/main/java/.../config nao registra nenhum
#    WebMvcConfigurer de recursos estaticos, logo vale o comportamento padrao
#    do Spring Boot (classpath:/static/). Injetar web/dist em
#    BOOT-INF/classes/static/ faz a SPA ser servida na MESMA origem da API
#    sem alterar uma unica linha de codigo ou de configuracao do backend.
#
#  Nenhum caminho antigo e referenciado: o Gradle vive em backend/demo/ e o
#  Vite em web/.
# ==========================================================================

ARG NODE_IMAGE=node:20-alpine
ARG GRADLE_IMAGE=gradle:jdk21
ARG JRE_IMAGE=eclipse-temurin:21-jre-alpine


# --------------------------------------------------------------------------
# Estagio 1/3 - build do frontend (TypeScript + Vite)  ->  web/dist
# --------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS web-build
WORKDIR /web

# Manifesto antes do codigo: a camada de dependencias fica em cache no Docker.
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY web/ ./

# Base da API gravada no bundle pelo Vite:
#   ""  (padrao) -> mesma origem; usar quando o Spring serve a propria SPA
#   http://...   -> API em outro host (ex.: o servidor Node na porta 3333)
ARG VITE_API_BASE="same-origin"
ENV VITE_API_BASE=${VITE_API_BASE}

# `build` = `typecheck` + `vite build`. Bundle quebrado ou erro de tipo
# derrubam o build da imagem aqui, e nao em producao.
RUN npm run build


# --------------------------------------------------------------------------
# Estagio 2/3 - bootJar do backend + injecao do frontend
# --------------------------------------------------------------------------
FROM ${GRADLE_IMAGE} AS api-build
WORKDIR /src

# Manifestos primeiro: resolucao de dependencias do Gradle em cache.
COPY backend/demo/build.gradle backend/demo/settings.gradle ./
COPY backend/demo/src ./src
RUN gradle --no-daemon --console=plain clean bootJar -x test \
 && cp "$(find build/libs -maxdepth 1 -name '*.jar' ! -name '*-plain.jar' | head -n 1)" /tmp/app.jar

# Injeta web/dist em BOOT-INF/classes/static/ usando o `jar` do proprio JDK
# (nao precisa de unzip/zip no Debian do gradle:jdk21).
COPY --from=web-build /web/dist /tmp/web-dist
RUN mkdir -p /tmp/root/BOOT-INF/classes \
 && cp -a /tmp/web-dist /tmp/root/BOOT-INF/classes/static \
 && cd /tmp/root \
 && jar uf /tmp/app.jar BOOT-INF/classes/static \
 && rm -rf /tmp/root /tmp/web-dist \
 && jar tf /tmp/app.jar | grep -q '^BOOT-INF/classes/static/index.html$' \
 && echo "frontend injetado no jar com sucesso"


# --------------------------------------------------------------------------
# Estagio 3/3 - runtime
# --------------------------------------------------------------------------
FROM ${JRE_IMAGE}
WORKDIR /app

COPY --from=api-build /tmp/app.jar /app/app.jar

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+UseSerialGC" \
    PORT=8081

EXPOSE 8081

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]