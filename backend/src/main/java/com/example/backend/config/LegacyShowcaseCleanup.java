package com.example.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * A vitrine (tabela showcase_art) foi substituída pelas publicações na V3. O Hibernate não apaga tabelas antigas,
 * e as chaves estrangeiras dela impediriam apagar arquivos, tarefas e projetos. A equipe decidiu não migrar as
 * artes antigas: a tabela é apagada na primeira vez que a V3 liga.
 */
@Component
public class LegacyShowcaseCleanup {

    private static final Logger log = LoggerFactory.getLogger(LegacyShowcaseCleanup.class);

    private final JdbcTemplate jdbc;

    public LegacyShowcaseCleanup(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void dropShowcaseTable() {
        try {
            Integer exists = jdbc.queryForObject(
                    "select count(*) from information_schema.tables where table_name = 'showcase_art'", Integer.class);
            if (exists != null && exists > 0) {
                jdbc.execute("drop table showcase_art cascade");
                log.info("Tabela antiga showcase_art (vitrine) apagada.");
            }
        } catch (RuntimeException exception) {
            log.warn("Não foi possível apagar a tabela antiga showcase_art: {}", exception.getMessage());
        }
    }
}
