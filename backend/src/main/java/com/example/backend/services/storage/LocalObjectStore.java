package com.example.backend.services.storage;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;

/**
 * Arquivos numa pasta do servidor. Bom para desenvolvimento; no Render grátis o disco
 * é apagado a cada deploy ou reinício (use o modo S3 lá).
 */
public class LocalObjectStore implements ObjectStore {

    private final Path root;

    public LocalObjectStore(String directory) {
        this.root = Path.of(directory).toAbsolutePath().normalize();
    }

    @Override
    public void put(String name, InputStream input) throws IOException {
        try (input) {
            Files.createDirectories(root);
            Files.copy(input, resolve(name), StandardCopyOption.REPLACE_EXISTING);
        }
    }

    @Override
    public Optional<Resource> get(String name) {
        Path path = resolve(name);
        return Files.exists(path) ? Optional.of(new FileSystemResource(path)) : Optional.empty();
    }

    @Override
    public void delete(String name) {
        try {
            Files.deleteIfExists(resolve(name));
        } catch (IOException ignored) {
            // Um arquivo órfão no disco não expõe nada.
        }
    }

    @Override
    public String describe() {
        return "disco local em " + root;
    }

    /** Caminho no disco, sempre dentro da pasta raiz (barra "../" e afins). */
    public Path resolve(String name) {
        Path path = root.resolve(name).normalize();
        if (!path.startsWith(root) || path.equals(root)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome de arquivo inválido.");
        }
        return path;
    }
}
