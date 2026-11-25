# Backend WorkAt (Spring Boot 3.2.5 / Java 17) para o Render.
# Etapa 1: compila o .jar com Maven (os testes rodam no seu PC, não no deploy).
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package && cp target/*.jar app.jar

# Etapa 2: só o Java para rodar, imagem bem menor.
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/app.jar app.jar

# O plano grátis do Render tem 512 MB de RAM: a JVM usa no máximo ~70% disso.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70.0 -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1"
# Arquivos enviados nas tarefas (disco temporário no plano grátis: some a cada deploy/reinício).
ENV ARTHUB_STORAGE_DIR=/app/uploads

# O Render informa a porta em PORT; o application.properties já lê essa variável.
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
