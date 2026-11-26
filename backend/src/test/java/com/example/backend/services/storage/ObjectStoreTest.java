package com.example.backend.services.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.core.io.Resource;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.AbortableInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ObjectStoreTest {

    @TempDir
    Path dir;

    // ---- Disco local ----

    @Test
    void localStoresReadsAndDeletes() throws Exception {
        LocalObjectStore store = new LocalObjectStore(dir.toString());

        store.put("a.png", new ByteArrayInputStream("oi".getBytes(StandardCharsets.UTF_8)));
        Optional<Resource> loaded = store.get("a.png");

        assertTrue(loaded.isPresent());
        assertEquals("oi", new String(loaded.get().getInputStream().readAllBytes(), StandardCharsets.UTF_8));
        store.delete("a.png");
        assertTrue(store.get("a.png").isEmpty());
    }

    @Test
    void localMissingFileIsEmptyAndDeleteDoesNotFail() {
        LocalObjectStore store = new LocalObjectStore(dir.toString());

        assertTrue(store.get("nao-existe.png").isEmpty());
        assertDoesNotThrow(() -> store.delete("nao-existe.png"));
    }

    @Test
    void localRejectsPathTraversal() {
        LocalObjectStore store = new LocalObjectStore(dir.resolve("uploads").toString());

        assertThrows(ResponseStatusException.class, () -> store.get("../segredo.txt"));
    }

    // ---- S3 ----

    @Test
    void s3UploadsUnderThePrefix() throws Exception {
        S3Client client = mock(S3Client.class);
        S3ObjectStore store = new S3ObjectStore(client, "workat", "/arquivos/");

        store.put("a.png", new ByteArrayInputStream("conteudo".getBytes(StandardCharsets.UTF_8)));

        ArgumentCaptor<PutObjectRequest> request = ArgumentCaptor.forClass(PutObjectRequest.class);
        ArgumentCaptor<RequestBody> body = ArgumentCaptor.forClass(RequestBody.class);
        verify(client).putObject(request.capture(), body.capture());
        assertEquals("workat", request.getValue().bucket());
        assertEquals("arquivos/a.png", request.getValue().key());
        assertEquals(8L, body.getValue().optionalContentLength().orElse(-1L));
    }

    @Test
    void s3ReadsExistingObject() throws Exception {
        S3Client client = mock(S3Client.class);
        ResponseInputStream<GetObjectResponse> stream = new ResponseInputStream<>(
                GetObjectResponse.builder().build(),
                AbortableInputStream.create(new ByteArrayInputStream("img".getBytes(StandardCharsets.UTF_8))));
        when(client.getObject(any(GetObjectRequest.class))).thenReturn(stream);

        Optional<Resource> loaded = new S3ObjectStore(client, "workat", "").get("a.png");

        assertTrue(loaded.isPresent());
        assertEquals("img", new String(loaded.get().getInputStream().readAllBytes(), StandardCharsets.UTF_8));
    }

    @Test
    void s3MissingObjectIsEmpty() {
        S3Client client = mock(S3Client.class);
        when(client.getObject(any(GetObjectRequest.class)))
                .thenThrow(NoSuchKeyException.builder().statusCode(404).message("missing").build());

        assertTrue(new S3ObjectStore(client, "workat", "").get("a.png").isEmpty());
    }

    @Test
    void s3DeletesObject() {
        S3Client client = mock(S3Client.class);

        new S3ObjectStore(client, "workat", "").delete("a.png");

        ArgumentCaptor<DeleteObjectRequest> request = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(client).deleteObject(request.capture());
        assertEquals("a.png", request.getValue().key());
    }

    @Test
    void s3RejectsNamesThatEscapeThePrefix() {
        S3ObjectStore store = new S3ObjectStore(mock(S3Client.class), "workat", "arquivos");

        assertThrows(ResponseStatusException.class, () -> store.get("../a.png"));
        assertThrows(ResponseStatusException.class, () -> store.get("outra/a.png"));
    }
}
