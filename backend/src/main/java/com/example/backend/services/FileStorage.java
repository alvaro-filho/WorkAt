package com.example.backend.services;

import com.example.backend.services.storage.LocalObjectStore;
import com.example.backend.services.storage.ObjectStore;
import com.example.backend.services.storage.S3ObjectStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Único ponto de acesso aos arquivos enviados (tarefas e publicações). Nomes são sempre UUID + extensão.
 *
 * Modo escolhido por app.storage.type:
 * - local (padrão): pasta app.storage.dir no servidor. No Render grátis, apagada a cada deploy/reinício.
 * - s3: bucket compatível com S3 (Cloudflare R2, Supabase Storage, Backblaze B2, AWS). Sobrevive a reinícios.
 */
@Component
public class FileStorage {

    private static final Logger log = LoggerFactory.getLogger(FileStorage.class);

    private final ObjectStore store;

    /** Modo local, usado nos testes e por quem não configura nada. */
    public FileStorage(String storageDir) {
        this(new LocalObjectStore(storageDir));
    }

    public FileStorage(ObjectStore store) {
        this.store = store;
    }

    @Autowired
    public FileStorage(@Value("${app.storage.type:local}") String type,
                       @Value("${app.storage.dir:uploads}") String storageDir,
                       @Value("${app.storage.s3.endpoint:}") String endpoint,
                       @Value("${app.storage.s3.region:auto}") String region,
                       @Value("${app.storage.s3.bucket:}") String bucket,
                       @Value("${app.storage.s3.access-key:}") String accessKey,
                       @Value("${app.storage.s3.secret-key:}") String secretKey,
                       @Value("${app.storage.s3.path-style:true}") boolean pathStyle,
                       @Value("${app.storage.s3.prefix:}") String prefix) {
        this(chooseStore(type, storageDir, endpoint, region, bucket, accessKey, secretKey, pathStyle, prefix));
        log.info("Arquivos enviados ficam em: {}", store.describe());
    }

    static ObjectStore chooseStore(String type, String storageDir, String endpoint, String region, String bucket,
                                   String accessKey, String secretKey, boolean pathStyle, String prefix) {
        String mode = type == null ? "local" : type.trim().toLowerCase(Locale.ROOT);
        switch (mode) {
            case "", "local" -> {
                return new LocalObjectStore(storageDir);
            }
            case "s3" -> {
                List<String> missing = new ArrayList<>();
                if (isBlank(bucket)) missing.add("ARTHUB_S3_BUCKET");
                if (isBlank(accessKey)) missing.add("ARTHUB_S3_ACCESS_KEY");
                if (isBlank(secretKey)) missing.add("ARTHUB_S3_SECRET_KEY");
                if (!missing.isEmpty()) {
                    // Falhar na subida é melhor do que perder arquivos depois sem perceber.
                    throw new IllegalStateException("Armazenamento S3 ligado, mas faltam variáveis: "
                            + String.join(", ", missing));
                }
                return new S3ObjectStore(
                        S3ObjectStore.buildClient(endpoint, region, accessKey, secretKey, pathStyle),
                        bucket.trim(), prefix);
            }
            default -> throw new IllegalStateException(
                    "app.storage.type inválido: \"" + type + "\". Use local ou s3.");
        }
    }

    /** Grava com um nome novo (UUID + extensão) e devolve o nome. */
    public String save(InputStream input, String extension) {
        String storedName = UUID.randomUUID() + "." + extension;
        store(storedName, input);
        return storedName;
    }

    /** Grava com o nome informado. */
    public void store(String storedName, InputStream input) {
        try {
            store.put(storedName, input);
        } catch (IOException exception) {
            log.warn("Falha ao salvar arquivo {}", storedName, exception);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível salvar o arquivo.");
        }
    }

    /** Conteúdo do arquivo, ou vazio se ele não existe mais. */
    public Optional<Resource> load(String storedName) {
        if (storedName == null) {
            return Optional.empty();
        }
        return store.get(storedName);
    }

    public void delete(String storedName) {
        if (storedName == null) {
            return;
        }
        store.delete(storedName);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
