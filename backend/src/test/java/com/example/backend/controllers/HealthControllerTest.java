package com.example.backend.controllers;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HealthControllerTest {

    @Test
    void answersOkWithoutTouchingTheDatabase() {
        assertEquals(Map.of("status", "ok"), new HealthController().health());
    }
}
