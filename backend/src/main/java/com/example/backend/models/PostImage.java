package com.example.backend.models;

import jakarta.persistence.*;

/**
 * Imagem de uma publicação. No WIP (e no "Publicar como post") aponta para o arquivo da tarefa, sem cópia;
 * no post avulso o arquivo é da própria publicação (storedName).
 */
@Entity
@Table(name = "post_image", indexes = @Index(name = "idx_post_image_task_file", columnList = "task_file_id"))
public class PostImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_file_id")
    private TaskFile taskFile;

    @Column(length = 80)
    private String storedName;

    @Column(length = 120)
    private String contentType;

    private long sizeBytes;

    @Column(nullable = false)
    private int position;

    public static PostImage ofTaskFile(TaskFile file) {
        PostImage image = new PostImage();
        image.setTaskFile(file);
        return image;
    }

    public static PostImage ofStored(String storedName, String contentType, long sizeBytes) {
        PostImage image = new PostImage();
        image.setStoredName(storedName);
        image.setContentType(contentType);
        image.setSizeBytes(sizeBytes);
        return image;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Post getPost() { return post; }
    public void setPost(Post post) { this.post = post; }
    public TaskFile getTaskFile() { return taskFile; }
    public void setTaskFile(TaskFile taskFile) { this.taskFile = taskFile; }
    public String getStoredName() { return storedName; }
    public void setStoredName(String storedName) { this.storedName = storedName; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long sizeBytes) { this.sizeBytes = sizeBytes; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}
