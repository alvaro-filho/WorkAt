package com.example.backend.services;

import com.example.backend.services.storage.LocalObjectStore;
import com.example.backend.services.storage.ObjectStore;
import com.example.backend.services.storage.S3ObjectStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class FileStorageTest {

    @TempDir
    Path dir;

    @Test
    void localIsTheDefault() {
        ObjectStore store = FileStorage.chooseStore(null, dir.toString(), "", "auto", "", "", "", true, "");
        assertInstanceOf(LocalObjectStore.class, store);
    }

    @Test
    void s3ModeNeedsBucketAndKeys() {
        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> FileStorage.chooseStore("s3", dir.toString(), "https://exemplo.r2.cloudflarestorage.com",
                        "auto", "", "chave", "", true, ""));
        assertTrue(error.getMessage().contains("ARTHUB_S3_BUCKET"));
        assertTrue(error.getMessage().contains("ARTHUB_S3_SECRET_KEY"));
    }

    @Test
    void s3ModeWithEverythingBuildsTheS3Store() {
        ObjectStore store = FileStorage.chooseStore("S3", dir.toString(), "https://exemplo.r2.cloudflarestorage.com",
                "auto", "workat", "chave", "segredo", true, "");
        assertInstanceOf(S3ObjectStore.class, store);
    }

    @Test
    void unknownModeFailsAtStartup() {
        assertThrows(IllegalStateException.class,
                () -> FileStorage.chooseStore("ftp", dir.toString(), "", "", "", "", "", true, ""));
    }

    @Test
    void savesWithUuidNameAndLoadsBack() {
        FileStorage storage = new FileStorage(dir.toString());

        String name = storage.save(new ByteArrayInputStream(new byte[] {1, 2, 3}), "png");

        assertTrue(name.matches("[0-9a-f-]{36}\\.png"));
        assertTrue(Files.exists(dir.resolve(name)));
        assertTrue(storage.load(name).isPresent());
        storage.delete(name);
        assertTrue(storage.load(name).isEmpty());
        assertTrue(storage.load(null).isEmpty());
    }
}
