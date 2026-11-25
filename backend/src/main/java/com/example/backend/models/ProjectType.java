package com.example.backend.models;

/**
 * Tipo do projeto, que define quem participa e o que cada um pode fazer.
 * PERSONAL: só o dono. COOPERATIVE: dono + amigos convidados. CORPORATE: dono + contratados (pode ter NDA).
 */
public enum ProjectType {
    PERSONAL,
    COOPERATIVE,
    CORPORATE
}
