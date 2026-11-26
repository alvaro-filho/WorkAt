package com.example.backend.models;

public enum InvitationStatus {
    PENDING,
    ACCEPTED,
    DECLINED,
    /** O dono desistiu do convite. */
    CANCELLED,
    /** Passou do prazo sem resposta. */
    EXPIRED
}
