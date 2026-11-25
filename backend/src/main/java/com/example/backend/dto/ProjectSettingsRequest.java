package com.example.backend.dto;

public class ProjectSettingsRequest {
    /** Só vale no corporativo: contratados veem todas as tarefas. */
    private Boolean contractorsSeeAllTasks;

    /** Só vale no corporativo: liga a trava de NDA nas artes do projeto. */
    private Boolean ndaEnabled;

    public Boolean getNdaEnabled() { return ndaEnabled; }
    public void setNdaEnabled(Boolean ndaEnabled) { this.ndaEnabled = ndaEnabled; }

    public Boolean getContractorsSeeAllTasks() { return contractorsSeeAllTasks; }
    public void setContractorsSeeAllTasks(Boolean contractorsSeeAllTasks) { this.contractorsSeeAllTasks = contractorsSeeAllTasks; }
}
