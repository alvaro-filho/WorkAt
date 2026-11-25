package com.example.backend.dto;

import java.time.LocalDate;

public class NdaStatusUpdateRequest {
    private String status;
    private LocalDate releaseDate;
    private String note;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDate getReleaseDate() { return releaseDate; }
    public void setReleaseDate(LocalDate releaseDate) { this.releaseDate = releaseDate; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
