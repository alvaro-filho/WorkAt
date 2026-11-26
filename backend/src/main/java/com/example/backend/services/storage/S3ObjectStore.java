package com.example.backend.services.storage;

import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.interceptor.Context;
import software.amazon.awssdk.core.interceptor.ExecutionAttributes;
import software.amazon.awssdk.core.interceptor.ExecutionInterceptor;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.SdkHttpRequest;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;

/**
 * Arquivos num bucket compatível com S3: Cloudflare R2, Supabase Storage, Backblaze B2, AWS S3...
 * Sobrevive a deploys e reinícios do servidor, ao contrário do disco do Render grátis.
 */
public class S3ObjectStore implements ObjectStore {

    private final S3Client client;
    private final String bucket;
    private final String prefix;

    public S3ObjectStore(S3Client client, String bucket, String prefix) {
        this.client = client;
        this.bucket = bucket;
        this.prefix = normalizePrefix(prefix);
    }

    /** Cliente a partir da configuração (endpoint vazio = AWS S3 na região informada). */
    public static S3Client buildClient(String endpoint, String region, String accessKey, String secretKey,
                                       boolean pathStyle) {
        var builder = S3Client.builder()
                .httpClient(UrlConnectionHttpClient.create())
                .region(Region.of(region == null || region.isBlank() ? "auto" : region.trim()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey.trim(), secretKey.trim())))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(pathStyle).build())
                .overrideConfiguration(ClientOverrideConfiguration.builder()
                        .addExecutionInterceptor(new WithoutExpectContinue())
                        .build());
        if (endpoint != null && !endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint.trim()));
        }
        return builder.build();
    }

    @Override
    public void put(String name, InputStream input) throws IOException {
        // O S3 precisa do tamanho antes do envio; um arquivo temporário evita guardar até 500 MB na memória.
        Path temp = Files.createTempFile("workat-upload-", ".tmp");
        try (input) {
            Files.copy(input, temp, StandardCopyOption.REPLACE_EXISTING);
            client.putObject(PutObjectRequest.builder().bucket(bucket).key(key(name)).build(), RequestBody.fromFile(temp));
        } catch (S3Exception exception) {
            throw new IOException("Falha ao enviar o arquivo para o armazenamento.", exception);
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    @Override
    public Optional<Resource> get(String name) {
        try {
            ResponseInputStream<GetObjectResponse> stream =
                    client.getObject(GetObjectRequest.builder().bucket(bucket).key(key(name)).build());
            return Optional.of(new InputStreamResource(stream));
        } catch (NoSuchKeyException missing) {
            return Optional.empty();
        } catch (S3Exception exception) {
            if (exception.statusCode() == 404) {
                return Optional.empty();
            }
            throw exception;
        }
    }

    @Override
    public void delete(String name) {
        try {
            client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key(name)).build());
        } catch (S3Exception ignored) {
            // O registro sai do banco mesmo assim; um objeto órfão no bucket não expõe nada.
        }
    }

    @Override
    public String describe() {
        return "bucket S3 \"" + bucket + "\"" + (prefix.isEmpty() ? "" : " (pasta " + prefix + ")");
    }

    /**
     * Tira o "Expect: 100-continue" dos envios. Com o cliente HTTP do JDK, a resposta 100 de alguns
     * serviços compatíveis com S3 chega como erro ("Status Code: 100") e o upload falha.
     */
    static final class WithoutExpectContinue implements ExecutionInterceptor {
        @Override
        public SdkHttpRequest modifyHttpRequest(Context.ModifyHttpRequest context,
                                                ExecutionAttributes executionAttributes) {
            return context.httpRequest().toBuilder().removeHeader("Expect").build();
        }
    }

    String key(String name) {
        if (name == null || name.isBlank() || name.contains("/") || name.contains("\\") || name.contains("..")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome de arquivo inválido.");
        }
        return prefix + name;
    }

    private static String normalizePrefix(String prefix) {
        if (prefix == null || prefix.isBlank()) {
            return "";
        }
        String clean = prefix.trim().replaceAll("^/+", "").replaceAll("/+$", "");
        return clean.isEmpty() ? "" : clean + "/";
    }
}
