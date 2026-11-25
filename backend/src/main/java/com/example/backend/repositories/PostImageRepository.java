package com.example.backend.repositories;

import com.example.backend.models.PostImage;
import com.example.backend.models.TaskFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PostImageRepository extends JpaRepository<PostImage, Long> {
    List<PostImage> findByTaskFileIn(Collection<TaskFile> files);
}
