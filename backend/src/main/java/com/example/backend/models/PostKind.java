package com.example.backend.models;

/** De onde a publicação veio. */
public enum PostKind {
    /** Imagem enviada numa tarefa de projeto com WIP automático (envios de 30 min se juntam). */
    WIP,
    /** Post avulso, estilo X; pode estar ligado a uma imagem de tarefa ("Publicar como post"). */
    STANDALONE,
    /** Aviso único de que o projeto ficou público. */
    PROJECT_PUBLISHED
}
