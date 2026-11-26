package com.example.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Ajustes de schema que o ddl-auto=update não faz sozinho.
 *
 * O Hibernate cria um CHECK com os valores do enum quando a tabela nasce, mas não atualiza esse CHECK
 * quando o enum ganha valores novos. Em bancos antigos (produção), convites CANCELLED/EXPIRED seriam
 * recusados pelo banco. Remover o CHECK resolve: o Java já só grava valores válidos.
 */
@Component
public class SchemaUpgrades implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaUpgrades.class);

    private static final List<String> STATEMENTS = List.of(
            "alter table if exists project_invitation drop constraint if exists project_invitation_status_check");

    private final JdbcTemplate jdbc;

    public SchemaUpgrades(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (String sql : STATEMENTS) {
            try {
                jdbc.execute(sql);
            } catch (RuntimeException exception) {
                // Não impede a subida: o pior caso é o mesmo de antes deste ajuste.
                log.warn("Ajuste de schema não aplicado ({}): {}", sql, exception.getMessage());
            }
        }
    }
}
