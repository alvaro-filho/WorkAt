package com.example.backend.dto;

import com.example.backend.models.JobCall;
import com.example.backend.models.User;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/** Disponibilidade para trabalho e o diretório de artistas (Explorar › Artistas e sugestões da Chamada). */
public final class ArtistDtos {

    private ArtistDtos() {
    }

    /**
     * "Disponível para trabalho": formatos aceitos, onde (remoto, presencial ou híbrido, com cidade) e uma linha
     * livre ("Livre a partir de janeiro"). available false = selo desligado.
     */
    public record Availability(boolean available, List<JobCall.Format> formats, JobCall.Location location,
                               String city, String note, LocalDateTime updatedAt) {

        public static Availability of(User user) {
            List<JobCall.Format> formats = user.getAvailableFormats() == null || user.getAvailableFormats().isBlank()
                    ? List.of()
                    : Arrays.stream(user.getAvailableFormats().split(","))
                            .map(String::trim)
                            .filter(value -> !value.isEmpty())
                            .map(JobCall.Format::valueOf)
                            .toList();
            JobCall.Location location = user.getAvailableLocation() == null ? null
                    : JobCall.Location.valueOf(user.getAvailableLocation());
            return new Availability(user.isAvailableForWork(), formats, location, user.getAvailableCity(),
                    user.getAvailableNote(), user.getAvailableUpdatedAt());
        }

        /** Para quem visita: só aparece quando o selo está ligado. */
        public static Availability publicOf(User user) {
            return user.isAvailableForWork() ? of(user) : null;
        }
    }

    public record AvailabilityRequest(Boolean available, List<JobCall.Format> formats, JobCall.Location location,
                                      String city, String note) {
    }

    /**
     * Artista no diretório: quem é, especialidades, disponibilidade (se ligada) e até três trabalhos públicos.
     * nudged: só nas sugestões da Chamada, se o estúdio já chamou a pessoa para olhar.
     */
    public record ArtistCard(UserSummary user, List<String> specialties, Availability availability,
                             List<PostResponse> works, LocalDateTime memberSince, boolean nudged) {
    }
}
