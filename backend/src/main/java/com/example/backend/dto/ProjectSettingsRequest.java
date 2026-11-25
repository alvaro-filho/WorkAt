package com.example.backend.dto;

public class ProjectSettingsRequest {
    /** Só vale no corporativo: contratados veem todas as tarefas. */
    private Boolean contractorsSeeAllTasks;

    /** Só vale no corporativo: liga a trava de NDA nas artes do projeto. */
    private Boolean ndaEnabled;

    /** Qualquer tipo: WIP automático (o projeto fica público). */
    private Boolean autoWip;
    /** Só corporativo: "AAAA-MM-DD" define, "" tira a data de liberação do NDA. */
    private String ndaReleaseDate;

    public Boolean getAutoWip() { return autoWip; }
    public void setAutoWip(Boolean autoWip) { this.autoWip = autoWip; }
    public String getNdaReleaseDate() { return ndaReleaseDate; }
    public void setNdaReleaseDate(String ndaReleaseDate) { this.ndaReleaseDate = ndaReleaseDate; }
    public Boolean getNdaEnabled() { return ndaEnabled; }
    public void setNdaEnabled(Boolean ndaEnabled) { this.ndaEnabled = ndaEnabled; }

    public Boolean getContractorsSeeAllTasks() { return contractorsSeeAllTasks; }
    public void setContractorsSeeAllTasks(Boolean contractorsSeeAllTasks) { this.contractorsSeeAllTasks = contractorsSeeAllTasks; }
}
