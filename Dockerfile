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
#   same-origin (padrao) -> a SPA fala com a API na MESMA origem (8081)
#   http://...            -> API em outro host (ex.: mock Node na porta 3333)
#   String vazia NAO funciona: o Vite descarta variaveis de ambiente com "".
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

# O WRAPPER e usado (nao o `gradle` da imagem): o `gradle:jdk21` traz uma
# versao "rolling" do Gradle, enquanto o projeto fixa a versao exata em
# gradle/wrapper/gradle-wrapper.properties. Sem o wrapper, o build do
# container usaria um Gradle diferente do build local e do CI.
COPY backend/demo/gradle ./gradle
COPY backend/demo/gradlew ./gradlew
RUN chmod +x ./gradlew

# Manifestos primeiro: resolucao de dependencias do Gradle em cache.
COPY backend/demo/build.gradle backend/demo/settings.gradle ./
COPY backend/demo/src ./src
RUN ./gradlew --no-daemon --console=plain clean bootJar -x test \
 && cp "$(find build/libs -maxdepth 1 -name '*.jar' ! -name '*-plain.jar' | head -n 1)" /tmp/app.jar

# Injeta web/dist em BOOT-INF/classes/static/ usando o `jar` do proprio JDK
# (nao precisa de unzip/zip no Debian do gradle:jdk21).
COPY --from=web-build /web/dist /tmp/web-dist
#
# A verificacao abaixo NAO usa variavel de shell de proposito.
# O builder do Docker so substitui variaveis em ADD/COPY/ENV/EXPOSE/FROM/
# LABEL/USER/VOLUME/WORKDIR; em `RUN` a substituicao fica a cargo do shell.
# Logo `$$f` chegaria cru ao shell, onde `$$` e o PID (viraria "1f.html").
# Cada `grep -qFx` exige a linha INTEIRA e literal, e o encadeamento com `&&`
# so chega ao `||` se todas as 9 verificacoes passarem.
RUN set -eu; \
    mkdir -p /tmp/root/BOOT-INF/classes; \
    cp -a /tmp/web-dist /tmp/root/BOOT-INF/classes/static; \
    cd /tmp/root; \
    jar uf /tmp/app.jar BOOT-INF/classes/static; \
    cd /; rm -rf /tmp/root /tmp/web-dist; \
    jar tf /tmp/app.jar > /tmp/jar-list.txt; \
    grep -qFx 'BOOT-INF/classes/static/index.html' /tmp/jar-list.txt && \
    grep -qFx 'BOOT-INF/classes/static/login.html' /tmp/jar-list.txt && \
    grep -qFx 'BOOT-INF/classes/static/dashboard.html' /tmp/jar-list.txt && \
    grep -qFx 'BOOT-INF/classes/static/admin.html' /tmp/jar-list.txt && \
    grep -qFx 'BOOT-INF/classes/static/coordenador.html' /tmp/jar-list.txt && \
    grep -qFx 'BOOT-INF/classes/static/instrutor.html' /tmp/jar-list.txt && \
    grep -qFx 'BOOT-INF/classes/static/recepcao.html' /tmp/jar-list.txt && \
    grep -qFx 'BOOT-INF/classes/static/css/main.css' /tmp/jar-list.txt && \
    grep -qFx 'BOOT-INF/classes/static/img/senac-logo-sem-fundo.webp' /tmp/jar-list.txt \
      || { echo "ERRO: o frontend nao foi injetado corretamente no jar."; \
           echo "Conteudo estatico encontrado:"; \
           grep -E 'BOOT-INF/classes/static' /tmp/jar-list.txt | head -20; \
           exit 1; }; \
    rm -f /tmp/jar-list.txt; \
    echo "frontend injetado no jar com sucesso (7 paginas + css + img)"


# --------------------------------------------------------------------------
# Estagio 3/3 - runtime
# --------------------------------------------------------------------------
FROM ${JRE_IMAGE}
WORKDIR /app

COPY --from=api-build /tmp/app.jar /app/app.jar

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+UseSerialGC" \
    PORT=8081

EXPOSE 8081

# Guarda de credencial.
#
# Se SUPABASE_DB_PASSWORD ainda for o valor de exemplo do .env.example, o
# container PARA na hora com uma mensagem legivel, em vez de reiniciar em
# loop com um stack trace de Hibernate que nao diz o que aconteceu.
#
# A comparacao roda no shell (sh do Alpine), por isso "$VAR" simples. Aqui
# NAO se usa "$$": este arquivo e um Dockerfile, nao um compose.yaml - o
# "$$" do Compose nao se aplica e produziria o PID do processo.
ENTRYPOINT ["sh", "-c", "case \"$SUPABASE_DB_PASSWORD\" in ''|SEU_*|SUA_*|CHANGE_*|changeme*|postgres) echo \"ERRO: a senha do Postgres ainda e o valor de exemplo do .env.example.\"; echo \"      Defina SUPABASE_DB_PASSWORD / POSTGRES_PASSWORD no .env e recrie o volume: docker compose down -v && docker compose up -d --build\"; exit 1;; esac; exec java $JAVA_OPTS -jar /app/app.jar"]
