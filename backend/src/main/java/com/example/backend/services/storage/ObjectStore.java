package com.example.backend.services.storage;

import org.springframework.core.io.Resource;

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

/** Onde os arquivos ficam de fato: disco local ou um serviço compatível com S3. */
public interface ObjectStore {

    /** Grava (ou substitui) o conteúdo com esse nome. Fecha o input. */
    void put(String name, InputStream input) throws IOException;

    /** Conteúdo para enviar na resposta, ou vazio se o arquivo não existe mais. */
    Optional<Resource> get(String name);

    /** Apaga; não reclama se já não existe. */
    void delete(String name);

    /** Nome curto do modo, para o log de inicialização. */
    String describe();
}
