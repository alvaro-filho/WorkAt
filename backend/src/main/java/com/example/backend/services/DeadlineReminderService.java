package com.example.backend.services;

import com.example.backend.events.WorkEvent;
import com.example.backend.models.Task;
import com.example.backend.repositories.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Lembrete da véspera: todo dia às 9h (horário de Brasília) avisa quem tem tarefa aberta vencendo amanhã.
 * Também roda ao ligar o servidor, porque no plano grátis ele pode estar dormindo às 9h.
 * Cada tarefa recebe no máximo um lembrete por prazo (a notificação guarda a chave).
 */
@Service
public class DeadlineReminderService {

    private static final Logger log = LoggerFactory.getLogger(DeadlineReminderService.class);
    static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

    private final TaskRepository taskRepository;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transaction;

    public DeadlineReminderService(TaskRepository taskRepository, ApplicationEventPublisher events,
                                   PlatformTransactionManager transactionManager) {
        this.taskRepository = taskRepository;
        this.events = events;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        try {
            transaction.executeWithoutResult(status -> remindDueTomorrow());
        } catch (RuntimeException exception) {
            log.warn("Lembretes de prazo não enviados na subida: {}", exception.getMessage());
        }
    }

    @Scheduled(cron = "0 0 9 * * *", zone = "America/Sao_Paulo")
    @Transactional
    public int remindDueTomorrow() {
        LocalDate tomorrow = LocalDate.now(ZONE).plusDays(1);
        List<Task> due = taskRepository.findOpenDueOn(tomorrow);
        for (Task task : due) {
            events.publishEvent(WorkEvent.of(WorkEvent.Type.DEADLINE_SOON, task.getProject(), task, null,
                    task.getAssignee(), tomorrow.toString()));
        }
        return due.size();
    }
}
