package com.example.backend.controllers;

import com.example.backend.dto.ArtistDtos.ArtistCard;
import com.example.backend.models.JobCall;
import com.example.backend.services.ArtistDirectoryService;
import com.example.backend.services.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Explorar › Artistas (público) e as sugestões de artistas disponíveis na Chamada (só o autor). */
@RestController
public class ArtistController {

    private final ArtistDirectoryService artists;
    private final CurrentUser currentUser;

    public ArtistController(ArtistDirectoryService artists, CurrentUser currentUser) {
        this.artists = artists;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/v1/explore/artists")
    public List<ArtistCard> explore(@RequestParam(required = false) JobCall.Role role,
                                    @RequestParam(defaultValue = "false") boolean available,
                                    Authentication authentication) {
        return artists.explore(role, available, currentUser.optional(authentication));
    }

    @GetMapping("/api/v1/calls/{id}/suggestions")
    public List<ArtistCard> suggestions(@PathVariable Long id, Authentication authentication) {
        return artists.suggestions(id, currentUser.require(authentication));
    }

    @PostMapping("/api/v1/calls/{id}/suggestions/{username}/nudge")
    public ResponseEntity<Void> nudge(@PathVariable Long id, @PathVariable String username,
                                      Authentication authentication) {
        artists.nudge(id, username, currentUser.require(authentication));
        return ResponseEntity.noContent().build();
    }
}
