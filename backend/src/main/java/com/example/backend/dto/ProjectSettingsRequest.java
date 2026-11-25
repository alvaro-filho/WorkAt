package com.example.backend.dto;

public class ProjectSettingsRequest {
    /** Só vale no corporativo: contratados veem todas as tarefas. */
    private Boolean contractorsSeeAllTasks;

    public Boolean getContractorsSeeAllTasks() { return contractorsSeeAllTasks; }
    public void setContractorsSeeAllTasks(Boolean contractorsSeeAllTasks) { this.contractorsSeeAllTasks = contractorsSeeAllTasks; }
}
