package com.flowboard.service;

import com.flowboard.dto.*;
import com.flowboard.entity.Board;
import com.flowboard.entity.Card;
import com.flowboard.entity.Project;
import com.flowboard.entity.Stage;
import com.flowboard.entity.User;
import com.flowboard.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProjectService {
    private static final int PROJECT_NAME_MAX = 255;
    private static final int PROJECT_DESCRIPTION_MAX = 5000;
    private static final int STAGE_TITLE_MAX = 100;
    private static final int CARD_TITLE_MAX = 255;
    private static final int CARD_DESCRIPTION_MAX = 5000;

    private final ProjectRepository projectRepository;
    private final BoardRepository boardRepository;
    private final StageRepository stageRepository;
    private final CardRepository cardRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final AIEngine aiEngine;
    private final BoardGenerator boardGenerator;
    private final BoardBroadcastService broadcastService;

    private enum ProjectMemberRole {
        OWNER,
        EDITOR,
        VIEWER;

        boolean canEdit() {
            return this == OWNER || this == EDITOR;
        }

        String toDbValue() {
            return name().toLowerCase();
        }

        static ProjectMemberRole fromRequest(String role) {
            if (role == null || role.isBlank()) {
                return VIEWER;
            }

            return switch (role.trim().toLowerCase()) {
                case "owner" -> OWNER;
                case "editor" -> EDITOR;
                case "viewer" -> VIEWER;
                default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid member role");
            };
        }

        static ProjectMemberRole fromStoredValue(String role) {
            if (role == null || role.isBlank()) {
                return VIEWER;
            }

            return fromRequest(role);
        }
    }

    @Transactional
    public ProjectDTO createProject(CreateProjectRequest request, User owner) {
        String normalizedName = normalizeRequiredText(request.getName(), "Project name is required", PROJECT_NAME_MAX, "Project name");
        String normalizedDescription = normalizeOptionalText(request.getDescription(), PROJECT_DESCRIPTION_MAX, "Project description");
        boolean generateTasks = !Boolean.FALSE.equals(request.getGenerateTasks());
        if (generateTasks) {
            ensureSufficientDescriptionForGeneration(normalizedDescription);
        }

        if (!projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, normalizedName).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Project name already exists for this owner");
        }

        // Create project
        Project project = Project.builder()
            .name(normalizedName)
            .description(normalizedDescription)
            .owner(owner)
            .members(java.util.Collections.singleton(owner))
            .isDeletionMarked(false)
            .build();

        project = projectRepository.save(project);
        projectMemberRepository.upsertMemberRole(project.getId(), owner.getId(), ProjectMemberRole.OWNER.toDbValue());

        if (!generateTasks) {
            Board emptyBoard = boardGenerator.generateEmptyBoard(project);
            ProjectDTO result = toProjectDTO(project, emptyBoard);
            broadcastService.broadcastProjectCreated(result);
            return result;
        }

        // Generate AI analysis
        AIAnalysisResult analysisResult = aiEngine.analyzeProjectDescription(
            normalizedName,
            normalizedDescription
        );

        // Generate board
        Board board = boardGenerator.generateBoard(project, analysisResult);

        ProjectDTO result = toProjectDTO(project, board);
        broadcastService.broadcastProjectCreated(result);
        return result;
    }

    @Transactional
    public ProjectDTO getProject(UUID projectId, UUID requesterId) {
        Project project = getProjectForAccess(projectId, requesterId);

        List<Board> boards = boardRepository.findByProjectId(projectId);
        Board board = boards.isEmpty() ? null : boards.get(0);

        return toProjectDTO(project, board);
    }

    @Transactional
    public List<ProjectDTO> getUserProjects(UUID userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        List<Project> projects = projectRepository.findActiveProjectsForUserId(userId);

        return projects.stream()
            .map(project -> {
                List<Board> boards = boardRepository.findByProjectId(project.getId());
                Board board = boards.isEmpty() ? null : boards.get(0);
                return toProjectDTO(project, board);
            })
            .collect(Collectors.toList());
    }

    @Transactional
    public ProjectDTO updateProject(UUID projectId, UUID userId, UpdateProjectRequest request) {
        Project project = getProjectForAccess(projectId, userId);
        requireEditableProject(project, userId);

        if (request.getName() != null && !request.getName().trim().isEmpty()) {
            String normalizedName = normalizeRequiredText(request.getName(), "Project name is required", PROJECT_NAME_MAX, "Project name");
            boolean duplicate = projectRepository.findActiveByOwnerAndNameIgnoreCase(project.getOwner(), normalizedName).stream()
                .anyMatch(existing -> !existing.getId().equals(project.getId()));
            if (duplicate) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Project name already exists for this owner");
            }
            project.setName(normalizedName);
        }

        if (request.getDescription() != null) {
            project.setDescription(normalizeOptionalText(request.getDescription(), PROJECT_DESCRIPTION_MAX, "Project description"));
        }

        Project savedProject = projectRepository.save(project);

        List<Board> boards = boardRepository.findByProjectId(projectId);
        Board board = boards.isEmpty() ? null : boards.get(0);
        ProjectDTO result = toProjectDTO(savedProject, board);
        broadcastService.broadcastProjectUpdated(projectId, result);
        return result;
    }

    @Transactional
    public void deleteProject(UUID projectId, UUID userId) {
        Project project = getProjectForAccess(projectId, userId);
        ensureProjectOwner(project, userId);

        project.setIsDeletionMarked(true);
        projectRepository.save(project);
        
        // Broadcast project deletion to all connected clients
        broadcastService.broadcastProjectDeleted(projectId);
    }

    @Transactional
    public CardDTO createCard(UUID stageId, String title, String description, String priority, UUID assigneeId, UUID userId) {
        Stage stage = stageRepository.findById(stageId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Stage not found"));
        if (Boolean.TRUE.equals(stage.getIsDeletionMarked())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Stage not found");
        }

        requireEditableProject(stage.getBoard().getProject(), userId);

        int newPosition = stage.getCards().size();

        Card card = Card.builder()
            .title(normalizeRequiredText(title, "Card title is required", CARD_TITLE_MAX, "Card title"))
            .description(normalizeOptionalText(description, CARD_DESCRIPTION_MAX, "Card description"))
            .priority(parsePriority(priority))
            .stage(stage)
            .position(newPosition)
            .assignee(resolveAssignee(stage.getBoard().getProject(), assigneeId))
            .build();

        card = cardRepository.save(card);
        CardDTO cardDTO = toCardDTO(card);
        
        // Broadcast the new card to all connected users viewing this board
        broadcastService.broadcastCardCreated(stage.getBoard().getId(), stageId, cardDTO);
        
        return cardDTO;
    }

    @Transactional
    public CardDTO updateCard(UUID cardId, String title, String description, String priority, UUID assigneeId, UUID userId) {
        Card card = cardRepository.findById(cardId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found"));
        if (Boolean.TRUE.equals(card.getIsDeletionMarked())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found");
        }

        requireEditableProject(card.getStage().getBoard().getProject(), userId);

        card.setTitle(normalizeRequiredText(title, "Card title is required", CARD_TITLE_MAX, "Card title"));
        card.setDescription(normalizeOptionalText(description, CARD_DESCRIPTION_MAX, "Card description"));
        if (priority != null) {
            card.setPriority(parsePriority(priority));
        }
        card.setAssignee(resolveAssignee(card.getStage().getBoard().getProject(), assigneeId));

        card = cardRepository.save(card);
        CardDTO cardDTO = toCardDTO(card);
        
        // Broadcast the updated card to all connected users viewing this board
        broadcastService.broadcastCardUpdated(card.getStage().getBoard().getId(), card.getStage().getId(), cardDTO);
        
        return cardDTO;
    }

    @Transactional
    public CardDTO moveCard(UUID cardId, UUID targetStageId, UUID userId) {
        Card card = cardRepository.findById(cardId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found"));
        if (Boolean.TRUE.equals(card.getIsDeletionMarked())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found");
        }

        Stage targetStage = stageRepository.findById(targetStageId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target stage not found"));
        if (Boolean.TRUE.equals(targetStage.getIsDeletionMarked())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Target stage not found");
        }

        Project sourceProject = card.getStage().getBoard().getProject();
        Project targetProject = targetStage.getBoard().getProject();
        if (!sourceProject.getId().equals(targetProject.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot move card across projects");
        }
        requireEditableProject(sourceProject, userId);

        // Update position in old stage
        Stage oldStage = card.getStage();
        int originalPosition = card.getPosition();
        oldStage.getCards().stream()
            .filter(c -> c.getPosition() > originalPosition)
            .forEach(c -> {
                c.setPosition(c.getPosition() - 1);
                cardRepository.save(c);
            });

        // Set new stage and position
        UUID boardId = card.getStage().getBoard().getId();
        UUID oldStageId = oldStage.getId();
        card.setStage(targetStage);
        card.setPosition(targetStage.getCards().size());

        Card savedCard = cardRepository.save(card);
        CardDTO cardDTO = toCardDTO(savedCard);
        
        // Broadcast the card move to all connected users viewing this board
        broadcastService.broadcastCardMoved(boardId, oldStageId, targetStageId, cardDTO, card.getPosition());
        
        return cardDTO;
    }

    @Transactional
    public void deleteCard(UUID cardId, UUID userId) {
        Card card = cardRepository.findById(cardId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found"));
        if (Boolean.TRUE.equals(card.getIsDeletionMarked())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found");
        }

        requireEditableProject(card.getStage().getBoard().getProject(), userId);

        UUID boardId = card.getStage().getBoard().getId();
        UUID stageId = card.getStage().getId();
        card.setIsDeletionMarked(true);
        cardRepository.save(card);
        
        // Broadcast the card deletion to all connected users viewing this board
        broadcastService.broadcastCardDeleted(boardId, stageId, cardId);
    }

    @Transactional
    public StageDTO addStage(UUID boardId, String title, String color, UUID userId) {
        Board board = boardRepository.findById(boardId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found"));
        if (Boolean.TRUE.equals(board.getIsDeletionMarked())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found");
        }

        requireEditableProject(board.getProject(), userId);

        int newPosition = board.getStages().size();

        Stage stage = Stage.builder()
            .title(normalizeRequiredText(title, "Stage title is required", STAGE_TITLE_MAX, "Stage title"))
            .color(color)
            .position(newPosition)
            .board(board)
            .cards(new ArrayList<>())
            .build();

        stage = stageRepository.save(stage);
        StageDTO stageDTO = toStageDTO(stage);
        
        // Broadcast the new stage to all connected users viewing this board
        broadcastService.broadcastStageCreated(boardId, stageDTO);
        
        return stageDTO;
    }

    @Transactional
    public void deleteStage(UUID stageId, UUID userId) {
        Stage stage = stageRepository.findById(stageId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Stage not found"));
        if (Boolean.TRUE.equals(stage.getIsDeletionMarked())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Stage not found");
        }

        requireEditableProject(stage.getBoard().getProject(), userId);

        UUID boardId = stage.getBoard().getId();
        stage.setIsDeletionMarked(true);
        stageRepository.save(stage);
        
        // Broadcast the stage deletion to all connected users viewing this board
        broadcastService.broadcastStageDeleted(boardId, stageId);
    }

    @Transactional
    public StageDTO renameStage(UUID stageId, String newTitle, UUID userId) {
        Stage stage = stageRepository.findById(stageId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Stage not found"));
        if (Boolean.TRUE.equals(stage.getIsDeletionMarked())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Stage not found");
        }

        requireEditableProject(stage.getBoard().getProject(), userId);

        stage.setTitle(normalizeRequiredText(newTitle, "Stage title is required", STAGE_TITLE_MAX, "Stage title"));
        stage = stageRepository.save(stage);
        StageDTO stageDTO = toStageDTO(stage);
        
        // Broadcast the stage update to all connected users viewing this board
        broadcastService.broadcastStageUpdated(stage.getBoard().getId(), stageDTO);
        
        return stageDTO;
    }

    @Transactional
    public List<TeamMemberDTO> getProjectMembers(UUID projectId, UUID userId) {
        Project project = getProjectForAccess(projectId, userId);
        Map<UUID, ProjectMemberRole> roleMap = getRoleMap(project);

        return getProjectParticipants(project).stream()
            .map(member -> toTeamMemberDTO(member, resolveRoleForUser(project, member.getId(), roleMap)))
            .sorted(Comparator.comparing((TeamMemberDTO m) -> m.getRole().equals("owner") ? 0 : 1)
                .thenComparing(TeamMemberDTO::getFullName, Comparator.nullsLast(String::compareToIgnoreCase)))
            .collect(Collectors.toList());
    }

    @Transactional
    public TeamMemberDTO addTeamMember(UUID projectId, String email, String role, UUID userId) {
        Project project = getProjectForAccess(projectId, userId);
        ensureProjectOwner(project, userId);

        String normalizedEmail = normalizeEmail(email);

        ProjectMemberRole requestedRole = ProjectMemberRole.fromRequest(role);
        if (requestedRole == ProjectMemberRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot add another owner");
        }

        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "User not found. Ask them to register first before adding to the project."
            ));

        if (Boolean.TRUE.equals(user.getIsDeletionMarked())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot add deleted user");
        }

        Map<UUID, ProjectMemberRole> roleMap = getRoleMap(project);
        boolean alreadyMember = roleMap.containsKey(user.getId()) || project.getOwner().getId().equals(user.getId());
        if (alreadyMember) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User is already a member of this project");
        }

        projectMemberRepository.upsertMemberRole(projectId, user.getId(), requestedRole.toDbValue());

        TeamMemberDTO result = toTeamMemberDTO(user, requestedRole);
        
        // Broadcast team member addition to all connected clients
        broadcastService.broadcastTeamMemberAdded(projectId, result);
        
        return result;
    }

    @Transactional
    public TeamMemberDTO updateTeamMemberRole(UUID projectId, UUID targetUserId, String role, UUID userId) {
        Project project = getProjectForAccess(projectId, userId);
        ensureProjectOwner(project, userId);

        if (targetUserId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot update your own role");
        }

        if (project.getOwner().getId().equals(targetUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot update project owner role");
        }

        if (!projectMemberRepository.findMemberRole(projectId, targetUserId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User is not a member of this project");
        }

        ProjectMemberRole requestedRole = ProjectMemberRole.fromRequest(role);
        if (requestedRole == ProjectMemberRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot assign owner role");
        }

        User targetUser = userRepository.findById(targetUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        projectMemberRepository.upsertMemberRole(projectId, targetUserId, requestedRole.toDbValue());
        TeamMemberDTO result = toTeamMemberDTO(targetUser, requestedRole);
        
        // Broadcast team member role change to all connected clients
        broadcastService.broadcastTeamMemberRoleChanged(projectId, targetUserId, role);
        
        return result;
    }

    @Transactional
    public void removeTeamMember(UUID projectId, UUID targetUserId, UUID userId) {
        Project project = getProjectForAccess(projectId, userId);
        ensureProjectOwner(project, userId);

        if (targetUserId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot remove yourself from this project");
        }

        if (project.getOwner().getId().equals(targetUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot remove project owner");
        }

        if (!projectMemberRepository.findMemberRole(projectId, targetUserId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User is not a member of this project");
        }

        projectMemberRepository.deleteMember(projectId, targetUserId);

        // Broadcast team member removal to all connected clients
        broadcastService.broadcastTeamMemberRemoved(projectId, targetUserId);
    }

    private ProjectDTO toProjectDTO(Project project, Board board) {
        List<StageDTO> stages = new ArrayList<>();
        if (board != null) {
            stages = board.getStages().stream()
                .filter(s -> !Boolean.TRUE.equals(s.getIsDeletionMarked()))
                .map(this::toStageDTO)
                .collect(Collectors.toList());
        }

        List<CardDTO> allCards = new ArrayList<>();
        for (StageDTO stage : stages) {
            allCards.addAll(stage.getCards());
        }

        Map<UUID, ProjectMemberRole> roleMap = getRoleMap(project);

        return ProjectDTO.builder()
            .id(project.getId())
            .name(project.getName())
            .description(project.getDescription())
            .boardId(board != null ? board.getId() : null)
            .members(getProjectParticipants(project, roleMap).stream()
                .map(member -> toUserDTO(member, resolveRoleForUser(project, member.getId(), roleMap)))
                .collect(Collectors.toList()))
            .columns(stages)
            .tasks(allCards)
            .createdAt(project.getCreatedAt())
            .build();
    }

    private StageDTO toStageDTO(Stage stage) {
        List<Card> stageCards = stage.getCards() != null ? stage.getCards() : new ArrayList<>();

        List<CardDTO> cards = stageCards.stream()
            .filter(c -> !Boolean.TRUE.equals(c.getIsDeletionMarked()))
            .map(this::toCardDTO)
            .collect(Collectors.toList());

        return StageDTO.builder()
            .id(stage.getId())
            .title(stage.getTitle())
            .color(stage.getColor())
            .cards(cards)
            .build();
    }

    private CardDTO toCardDTO(Card card) {
        return CardDTO.builder()
            .id(card.getId())
            .title(card.getTitle())
            .description(card.getDescription())
            .priority(card.getPriority().toString())
            .stageId(card.getStage().getId())
            .createdAt(card.getCreatedAt())
            .assignee(card.getAssignee() != null ? toUserDTO(card.getAssignee(), ProjectMemberRole.VIEWER) : null)
            .build();
    }

    private User resolveAssignee(Project project, UUID assigneeId) {
        if (assigneeId == null) {
            return null;
        }

        if (project.getOwner().getId().equals(assigneeId)) {
            return project.getOwner();
        }

        if (projectMemberRepository.findMemberRole(project.getId(), assigneeId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assignee must be a project member");
        }

        return userRepository.findById(assigneeId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assignee user not found"));
    }

    private UserDTO toUserDTO(User user, ProjectMemberRole role) {
        return UserDTO.builder()
            .id(user.getId())
            .email(user.getEmail())
            .username(user.getUsername())
            .fullName(user.getFullName())
            .role(role.toDbValue())
            .createdAt(user.getCreatedAt())
            .build();
    }

    private TeamMemberDTO toTeamMemberDTO(User user, ProjectMemberRole role) {
        return TeamMemberDTO.builder()
            .id(user.getId())
            .email(user.getEmail())
            .username(user.getUsername())
            .fullName(user.getFullName())
            .role(role.toDbValue())
            .createdAt(user.getCreatedAt())
            .build();
    }

    private Project getProjectForAccess(UUID projectId, UUID userId) {
        Project project = projectRepository.findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        if (Boolean.TRUE.equals(project.getIsDeletionMarked())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
        }

        if (!isProjectMember(project, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this project");
        }

        return project;
    }

    private boolean isProjectMember(Project project, UUID userId) {
        return project.getOwner().getId().equals(userId)
            || projectMemberRepository.findMemberRole(project.getId(), userId).isPresent();
    }

    private List<User> getProjectParticipants(Project project) {
        return getProjectParticipants(project, getRoleMap(project));
    }

    private List<User> getProjectParticipants(Project project, Map<UUID, ProjectMemberRole> roleMap) {
        Set<UUID> memberIds = new HashSet<>(roleMap.keySet());
        memberIds.add(project.getOwner().getId());

        Map<UUID, User> usersById = userRepository.findAllById(memberIds).stream()
            .collect(Collectors.toMap(User::getId, user -> user));

        Map<UUID, User> participants = new LinkedHashMap<>();
        participants.put(project.getOwner().getId(), usersById.get(project.getOwner().getId()));

        for (UUID memberId : memberIds) {
            if (memberId.equals(project.getOwner().getId())) {
                continue;
            }

            User participant = usersById.get(memberId);
            if (participant != null) {
                participants.put(memberId, participant);
            }
        }

        return new ArrayList<>(participants.values());
    }

    private void ensureProjectOwner(Project project, UUID userId) {
        if (!project.getOwner().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only project owner can perform this action");
        }
    }

    private void requireEditableProject(Project project, UUID userId) {
        if (!resolveRoleForUser(project, userId, getRoleMap(project)).canEdit()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Viewer role is read-only");
        }
    }

    private Map<UUID, ProjectMemberRole> getRoleMap(Project project) {
        Map<UUID, ProjectMemberRole> roleMap = new LinkedHashMap<>();
        for (Object[] row : projectMemberRepository.findProjectMemberRoles(project.getId())) {
            UUID memberId = row[0] instanceof UUID ? (UUID) row[0] : UUID.fromString(row[0].toString());
            ProjectMemberRole role = ProjectMemberRole.fromStoredValue(String.valueOf(row[1]));
            roleMap.put(memberId, role);
        }

        roleMap.put(project.getOwner().getId(), ProjectMemberRole.OWNER);
        return roleMap;
    }

    private ProjectMemberRole resolveRoleForUser(Project project, UUID userId, Map<UUID, ProjectMemberRole> roleMap) {
        if (project.getOwner().getId().equals(userId)) {
            return ProjectMemberRole.OWNER;
        }
        return roleMap.getOrDefault(userId, ProjectMemberRole.VIEWER);
    }

    private String normalizeRequiredText(String value, String requiredMessage, int maxLength, String fieldName) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, requiredMessage);
        }

        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " exceeds maximum length of " + maxLength);
        }

        return normalized;
    }

    private String normalizeOptionalText(String value, int maxLength, String fieldName) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " exceeds maximum length of " + maxLength);
        }

        return normalized;
    }

    private String normalizeEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }
        return email.trim().toLowerCase();
    }

    private Card.Priority parsePriority(String priority) {
        try {
            return Card.Priority.valueOf(priority.trim().toUpperCase());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Priority must be LOW, MEDIUM, HIGH, or CRITICAL");
        }
    }

    private void ensureSufficientDescriptionForGeneration(String description) {
        if (description == null || description.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project description is required for AI board generation");
        }

        long words = description.trim().split("\\s+").length;
        if (words < 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project description must contain at least 5 words for AI generation");
        }
    }
}
