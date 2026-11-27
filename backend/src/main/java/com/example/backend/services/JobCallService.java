package com.example.backend.services;

import com.example.backend.config.BusinessTime;
import com.example.backend.dto.JobCallDtos.CallRequest;
import com.example.backend.dto.JobCallDtos.CallResponse;
import com.example.backend.dto.JobCallDtos.InterestResponse;
import com.example.backend.dto.JobCallDtos.InviteResult;
import com.example.backend.dto.JobCallDtos.MyInterest;
import com.example.backend.dto.JobCallDtos.MyInterestItem;
import com.example.backend.dto.UserSummary;
import com.example.backend.models.JobCall;
import com.example.backend.models.JobInterest;
import com.example.backend.models.Notification;
import com.example.backend.models.Post;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.ProjectType;
import com.example.backend.models.Role;
import com.example.backend.models.User;
import com.example.backend.repositories.JobCallRepository;
import com.example.backend.repositories.JobInterestMessageRepository;
import com.example.backend.repositories.JobInterestRepository;
import com.example.backend.repositories.NotificationRepository;
import com.example.backend.repositories.PostRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Chamadas (vagas e jobs) e os interesses dos artistas.
 * - Só contas Empresa publicam; até 5 Chamadas abertas por conta; o prazo fecha a Chamada sozinho.
 * - Pagamento é opcional (o estúdio decide se mostra).
 * - Um interesse por artista em cada Chamada, com mensagem e até 6 trabalhos do próprio portfólio.
 * - Só o autor vê os interessados; "Convidar" cria (ou usa) um projeto corporativo e manda o convite normal.
 */
@Service
public class JobCallService {

    static final int MAX_OPEN_PER_COMPANY = 5;
    static final int MAX_WORKS = 6;
    static final int MAX_DAYS_OPEN = 180;

    private final JobCallRepository callRepository;
    private final JobInterestRepository interestRepository;
    private final PostRepository postRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final PostService postService;
    private final ProjectService projectService;
    private final ProjectMembershipService membershipService;
    private final NotificationRepository notificationRepository;
    /** Opcional (os testes antigos constroem o serviço sem ele): conta as mensagens de cada candidatura. */
    private JobInterestMessageRepository messageRepository;

    public JobCallService(JobCallRepository callRepository, JobInterestRepository interestRepository,
                          PostRepository postRepository, ProjectRepository projectRepository,
                          UserRepository userRepository, PostService postService, ProjectService projectService,
                          ProjectMembershipService membershipService, NotificationRepository notificationRepository) {
        this.callRepository = callRepository;
        this.interestRepository = interestRepository;
        this.postRepository = postRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.postService = postService;
        this.projectService = projectService;
        this.membershipService = membershipService;
        this.notificationRepository = notificationRepository;
    }

    @Autowired(required = false)
    public void setMessageRepository(JobInterestMessageRepository messageRepository) {
        this.messageRepository = messageRepository;
    }

    private long messageCount(JobInterest interest) {
        return messageRepository == null || interest.getId() == null ? 0 : messageRepository.countByInterest(interest);
    }

    // ---- Leitura ----

    /** Explorar: abertas, com filtros. Com author: as Chamadas daquele estúdio (abertas e preenchidas; todas para ele mesmo). */
    @Transactional(readOnly = true)
    public List<CallResponse> list(JobCall.Role role, JobCall.Format format, JobCall.Location location,
                                   String authorUsername, User viewer) {
        LocalDate today = BusinessTime.today();
        List<JobCall> calls;
        if (authorUsername != null && !authorUsername.isBlank()) {
            User author = userRepository.findByUsername(authorUsername.trim())
                    .filter(found -> !found.isDeleted())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Perfil não encontrado."));
            boolean self = ProjectAccessService.sameUser(author, viewer);
            calls = callRepository.findByAuthorOrderByIdDesc(author).stream()
                    .filter(call -> self || call.isOpen(today) || call.getStatus() == JobCall.Status.FILLED)
                    .toList();
        } else {
            calls = callRepository.findOpen(today);
        }
        return calls.stream()
                .filter(call -> role == null || call.getRole() == role)
                .filter(call -> format == null || call.getFormat() == format)
                .filter(call -> location == null || call.getLocation() == location)
                .map(call -> toResponse(call, viewer))
                .toList();
    }

    @Transactional(readOnly = true)
    public CallResponse get(Long id, User viewer) {
        return toResponse(find(id), viewer);
    }

    // ---- Publicar e editar ----

    @Transactional
    public CallResponse create(User user, CallRequest request) {
        if (user.getRole() != Role.COMPANY) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Só contas Empresa publicam Chamadas.");
        }
        if (callRepository.countOpenBy(user, BusinessTime.today()) >= MAX_OPEN_PER_COMPANY) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Você já tem " + MAX_OPEN_PER_COMPANY + " Chamadas abertas. Feche ou preencha uma antes de publicar outra.");
        }
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Preencha a Chamada.");
        }
        JobCall call = new JobCall();
        call.setAuthor(user);
        apply(call, request, true);
        return toResponse(callRepository.save(call), user);
    }

    @Transactional
    public CallResponse update(Long id, User user, CallRequest request) {
        JobCall call = find(id);
        requireAuthor(call, user);
        if (request == null) {
            return toResponse(call, user);
        }
        apply(call, request, false);
        if (request.status() != null && request.status() != call.getStatus()) {
            if (request.status() == JobCall.Status.OPEN && call.getClosesOn().isBefore(BusinessTime.today())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "O prazo já passou. Escolha uma nova data para reabrir a Chamada.");
            }
            call.setStatus(request.status());
            if (request.status() == JobCall.Status.FILLED) {
                // Preenchida: quem ainda esperava resposta fica sabendo.
                for (JobInterest interest : interestRepository.findByCallOrderByIdAsc(call)) {
                    if (interest.getStatus() == JobInterest.Status.SENT || interest.getStatus() == JobInterest.Status.SEEN) {
                        interest.setStatus(JobInterest.Status.NOT_SELECTED);
                        notify(interest.getArtist(), "CALL_STATUS",
                                "A Chamada \"" + call.getTitle() + "\" foi preenchida. Sua candidatura não foi selecionada desta vez.",
                                "/chamadas/" + call.getId());
                    }
                }
            }
        }
        return toResponse(callRepository.save(call), user);
    }

    // ---- Interesse do artista ----

    @Transactional
    public CallResponse interest(Long id, User user, String message, List<Long> postIds) {
        JobCall call = find(id);
        if (!call.isOpen(BusinessTime.today())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Esta Chamada não está mais aberta.");
        }
        if (ProjectAccessService.sameUser(call.getAuthor(), user)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Você não pode se candidatar à própria Chamada.");
        }
        if (user.getRole() != Role.ARTIST) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Só contas de Artista manifestam interesse.");
        }
        if (interestRepository.findByCallAndArtist(call, user).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Você já manifestou interesse nesta Chamada.");
        }
        String text = message == null ? "" : message.trim();
        if (text.isEmpty() || text.length() > 600) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escreva uma mensagem de até 600 caracteres.");
        }
        List<Long> works = new ArrayList<>(new LinkedHashSet<>(postIds == null ? List.of() : postIds));
        if (works.size() > MAX_WORKS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escolha até " + MAX_WORKS + " trabalhos.");
        }
        for (Long postId : works) {
            Post post = postRepository.findById(postId)
                    .filter(found -> ProjectAccessService.sameUser(found.getAuthor(), user) && PostService.isPublic(found))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Escolha só trabalhos públicos do seu portfólio."));
            Objects.requireNonNull(post);
        }
        JobInterest interest = new JobInterest();
        interest.setCall(call);
        interest.setArtist(user);
        interest.setMessage(text);
        interest.setWorkPostIds(works);
        interestRepository.save(interest);
        notify(call.getAuthor(), "CALL_INTEREST",
                user.getFullName() + " tem interesse na sua Chamada \"" + call.getTitle() + "\".",
                "/chamadas/" + call.getId());
        return toResponse(call, user);
    }

    /** O artista retira o interesse (enquanto não foi convidado). */
    @Transactional
    public CallResponse withdraw(Long id, User user) {
        JobCall call = find(id);
        JobInterest interest = interestRepository.findByCallAndArtist(call, user)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Você não tem interesse nesta Chamada."));
        if (interest.getStatus() == JobInterest.Status.INVITED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Você já foi convidado: responda ao convite em Notificações › Convites.");
        }
        interestRepository.delete(interest);
        return toResponse(call, user);
    }

    @Transactional(readOnly = true)
    public List<MyInterestItem> myInterests(User user) {
        LocalDate today = BusinessTime.today();
        return interestRepository.findByArtistOrderByIdDesc(user).stream()
                .map(interest -> new MyInterestItem(interest.getId(), interest.getStatus(), interest.getCreatedAt(),
                        interest.getProjectId(), interest.getCall().getId(), interest.getCall().getTitle(),
                        UserSummary.from(interest.getCall().getAuthor()),
                        interest.getCall().effectiveStatus(today), messageCount(interest)))
                .toList();
    }

    // ---- O estúdio responde ----

    /** Interessados (só o autor). Abrir a lista marca as candidaturas novas como vistas. */
    @Transactional
    public List<InterestResponse> interests(Long id, User user) {
        JobCall call = find(id);
        requireAuthor(call, user);
        List<JobInterest> all = interestRepository.findByCallOrderByIdAsc(call);
        for (JobInterest interest : all) {
            if (interest.getStatus() == JobInterest.Status.SENT) {
                interest.setStatus(JobInterest.Status.SEEN);
            }
        }
        return all.stream().map(interest -> toResponse(interest, user)).toList();
    }

    /**
     * Convidar para projeto: usa um projeto corporativo do autor (projectId) ou cria um a partir da Chamada,
     * com o NDA da Chamada, e manda o convite normal (chega em Notificações › Convites).
     */
    @Transactional
    public InviteResult invite(Long id, Long interestId, User user, Long projectId) {
        JobCall call = find(id);
        requireAuthor(call, user);
        JobInterest interest = interestOf(call, interestId);
        if (interest.getStatus() == JobInterest.Status.INVITED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Esse artista já foi convidado.");
        }
        Project project;
        if (projectId != null) {
            project = projectRepository.findById(projectId)
                    .filter(found -> ProjectAccessService.isOwner(found, user))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Projeto não encontrado."));
            if (project.getType() != ProjectType.CORPORATE) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escolha um projeto corporativo.");
            }
            if (project.getStatus() == ProjectStatus.CLOSED) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Esse projeto está encerrado.");
            }
        } else {
            Project draft = new Project();
            draft.setName(cut(call.getTitle(), 120));
            draft.setDescription(cut(call.getDescription(), 1000));
            draft.setType(ProjectType.CORPORATE);
            draft.setSlug(slug(call.getTitle()));
            project = projectService.createProject(draft, user);
            if (call.isNda()) {
                project = projectService.updateSettings(project.getId(), user, null, true, null, null);
            }
        }
        membershipService.invite(project.getId(), user, interest.getArtist().getEmail());
        interest.setStatus(JobInterest.Status.INVITED);
        interest.setProjectId(project.getId());
        interestRepository.save(interest);
        return new InviteResult(project.getId(), toResponse(interest, user));
    }

    @Transactional
    public InterestResponse decline(Long id, Long interestId, User user) {
        JobCall call = find(id);
        requireAuthor(call, user);
        JobInterest interest = interestOf(call, interestId);
        if (interest.getStatus() == JobInterest.Status.INVITED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Esse artista já foi convidado.");
        }
        if (interest.getStatus() != JobInterest.Status.NOT_SELECTED) {
            interest.setStatus(JobInterest.Status.NOT_SELECTED);
            notify(interest.getArtist(), "CALL_STATUS",
                    "Sua candidatura para \"" + call.getTitle() + "\" não foi selecionada desta vez.",
                    "/chamadas/" + call.getId());
        }
        return toResponse(interestRepository.save(interest), user);
    }

    // ---- Regras internas ----

    private JobCall find(Long id) {
        return callRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chamada não encontrada."));
    }

    private JobInterest interestOf(JobCall call, Long interestId) {
        return interestRepository.findById(interestId)
                .filter(interest -> interest.getCall().getId().equals(call.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidatura não encontrada."));
    }

    private static void requireAuthor(JobCall call, User user) {
        if (!ProjectAccessService.sameUser(call.getAuthor(), user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Só quem publicou a Chamada pode fazer isso.");
        }
    }

    /** Copia os campos do pedido; na criação, todos os obrigatórios precisam vir. */
    private static void apply(JobCall call, CallRequest request, boolean creating) {
        if (creating || request.title() != null) {
            String title = request.title() == null ? "" : request.title().trim();
            if (title.length() < 3 || title.length() > 120) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O título precisa ter entre 3 e 120 caracteres.");
            }
            call.setTitle(title);
        }
        if (creating || request.description() != null) {
            String description = request.description() == null ? "" : request.description().trim();
            if (description.length() < 20 || description.length() > 3000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Descreva o trabalho em 20 a 3000 caracteres.");
            }
            call.setDescription(description);
        }
        if (creating || request.role() != null) {
            call.setRole(required(request.role(), "Escolha a função."));
        }
        if (creating || request.format() != null) {
            call.setFormat(required(request.format(), "Escolha o formato."));
        }
        if (creating || request.location() != null) {
            call.setLocation(required(request.location(), "Escolha onde o trabalho acontece."));
        }
        if (creating || request.city() != null || request.location() != null) {
            String city = request.city() == null ? null : request.city().trim();
            if (call.getLocation() != JobCall.Location.REMOTO && (city == null || city.isEmpty())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a cidade do trabalho presencial ou híbrido.");
            }
            call.setCity(call.getLocation() == JobCall.Location.REMOTO ? null : cut(city, 80));
        }
        if (creating || request.payMin() != null || request.payMax() != null) {
            Integer min = request.payMin(), max = request.payMax();
            if ((min != null && min < 0) || (max != null && max < 0)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O pagamento não pode ser negativo.");
            }
            if (min != null && max != null && min > max) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O valor mínimo não pode ser maior que o máximo.");
            }
            call.setPayMin(min);
            call.setPayMax(max);
        }
        if (creating || request.closesOn() != null) {
            LocalDate closesOn = required(request.closesOn(), "Escolha até quando a Chamada recebe interessados.");
            LocalDate today = BusinessTime.today();
            if (closesOn.isBefore(today) || closesOn.isAfter(today.plusDays(MAX_DAYS_OPEN))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "O prazo precisa estar entre hoje e " + MAX_DAYS_OPEN + " dias.");
            }
            call.setClosesOn(closesOn);
        }
        if (request.nda() != null) {
            call.setNda(request.nda());
        }
    }

    private static <T> T required(T value, String message) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value;
    }

    private CallResponse toResponse(JobCall call, User viewer) {
        boolean mine = ProjectAccessService.sameUser(call.getAuthor(), viewer);
        MyInterest myInterest = viewer == null || mine ? null
                : interestRepository.findByCallAndArtist(call, viewer)
                        .map(interest -> new MyInterest(interest.getId(), interest.getStatus(), interest.getProjectId(),
                                messageCount(interest)))
                        .orElse(null);
        User author = call.getAuthor();
        int directed = (int) projectRepository.findByCreatedByUser(author).stream()
                .filter(project -> project.getType() == ProjectType.CORPORATE)
                .count();
        return new CallResponse(call.getId(), call.getTitle(), call.getRole(), call.getDescription(), call.getFormat(),
                call.getLocation(), call.getCity(), call.getPayMin(), call.getPayMax(), call.getClosesOn(), call.isNda(),
                call.effectiveStatus(BusinessTime.today()), call.getCreatedAt(), UserSummary.from(author),
                author.getCreatedAt(), directed, mine, mine ? interestRepository.countByCall(call) : null, myInterest);
    }

    private InterestResponse toResponse(JobInterest interest, User viewer) {
        List<Post> works = interest.getWorkPostIds().stream()
                .map(postRepository::findById)
                .flatMap(java.util.Optional::stream)
                .filter(post -> postService.canView(post, viewer))
                .toList();
        return new InterestResponse(interest.getId(), UserSummary.from(interest.getArtist()), interest.getMessage(),
                interest.getStatus(), interest.getCreatedAt(), postService.toResponses(works, viewer),
                interest.getProjectId(), messageCount(interest));
    }

    private void notify(User to, String type, String message, String link) {
        Notification notification = new Notification();
        notification.setUser(to);
        notification.setType(type);
        notification.setMessage(cut(message, 480));
        notification.setLink(link);
        notificationRepository.save(notification);
    }

    private static String cut(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() > max ? text.substring(0, max - 3) + "..." : text;
    }

    private static String slug(String title) {
        String base = java.text.Normalizer.normalize(title == null ? "" : title, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (base.length() > 60) {
            base = base.substring(0, 60);
        }
        return (base.isEmpty() ? "chamada" : base) + "-" + Long.toString(System.nanoTime() % 1_000_000L, 36);
    }
}
