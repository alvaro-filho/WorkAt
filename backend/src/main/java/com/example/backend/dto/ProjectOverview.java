package com.example.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Projeto como aparece na tela Projetos: os dados do projeto e um resumo do que está acontecendo nele,
 * contado só com as tarefas que a pessoa consegue ver.
 */
public record ProjectOverview(
        ProjectResponse project,
        int taskTotal,
        int taskDone,
        int taskInReview,
        int overdue,
        /** Tarefas abertas atribuídas a quem está vendo. */
        int mine,
        int memberCount,
        /** Até 5 pessoas (diretor primeiro) para o grupo de avatares do cartão. */
        List<UserSummary> people,
        /** Imagem para a capa do cartão (arquivo da tarefa, baixado com login); null = sem imagem ainda. */
        Long coverFileId,
        LocalDateTime lastActivityAt
) {
}
