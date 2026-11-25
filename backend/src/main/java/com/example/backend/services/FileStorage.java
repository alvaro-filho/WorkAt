package com.example.backend.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

/** Pasta de arquivos do backend (a mesma dos arquivos de tarefa). Nomes no disco são sempre UUID + extensão. */
@Component
public class FileStorage {

    private final Path root;

    public FileStorage(@Value("${app.storage.dir:uploads}") String storageDir) {
        this.root = Path.of(storageDir).toAbsolutePath().normalize();
    }

    public String save(InputStream input, String extension) {
        String storedName = UUID.randomUUID() + "." + extension;
        try (input) {
            Files.createDirectories(root);
            Files.copy(input, resolve(storedName), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível salvar o arquivo.");
        }
        return storedName;
    }

    public Path resolve(String storedName) {
        Path path = root.resolve(storedName).normalize();
        if (!path.startsWith(root)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome de arquivo inválido.");
        }
        return path;
    }

    public void delete(String storedName) {
        if (storedName == null) {
            return;
        }
        try {
            Files.deleteIfExists(resolve(storedName));
        } catch (IOException ignored) {
            // Um arquivo órfão no disco não expõe nada.
        }
    }
}
