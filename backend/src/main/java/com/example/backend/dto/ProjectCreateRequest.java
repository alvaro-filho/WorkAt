package com.example.backend.dto;

import com.example.backend.models.Project;
import com.example.backend.models.ProjectCategory;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Allowlisted client input for creating a project.
 * Unknown properties such as id and createdByUser are ignored and never copied.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProjectCreateRequest {

    private String name;
    private String slug;
    private String description;
    private ProjectCategory category;

    public Project toNewProject() {
        Project project = new Project();
        project.setName(name);
        project.setSlug(slug);
        project.setDescription(description);
        if (category != null) {
            project.setCategory(category);
        }
        return project;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public ProjectCategory getCategory() {
        return category;
    }

    public void setCategory(ProjectCategory category) {
        this.category = category;
    }
}
