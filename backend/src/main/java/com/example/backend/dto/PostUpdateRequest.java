package com.example.backend.dto;

/** Campos nulos ficam como estão. */
public class PostUpdateRequest {
    private String title;
    private String subtitle;
    private Boolean hiddenFromPortfolio;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSubtitle() { return subtitle; }
    public void setSubtitle(String subtitle) { this.subtitle = subtitle; }
    public Boolean getHiddenFromPortfolio() { return hiddenFromPortfolio; }
    public void setHiddenFromPortfolio(Boolean hiddenFromPortfolio) { this.hiddenFromPortfolio = hiddenFromPortfolio; }
}
