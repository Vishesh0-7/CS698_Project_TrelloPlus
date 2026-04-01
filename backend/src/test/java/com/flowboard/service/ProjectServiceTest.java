package com.flowboard.service;

import com.flowboard.dto.*;
import com.flowboard.entity.*;
import com.flowboard.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private BoardRepository boardRepository;

    @Mock
    private StageRepository stageRepository;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private AIEngine aiEngine;

    @Mock
    private BoardGenerator boardGenerator;

    @Mock
    private BoardBroadcastService broadcastService;

    @InjectMocks
    private ProjectService projectService;

    private User owner;
    private User member1;
    private User member2;
    private Project testProject;
    private Board testBoard;
    private Stage testStage;
    private Card testCard;

    private UUID ownerId;
    private UUID member1Id;
    private UUID member2Id;
    private UUID projectId;
    private UUID boardId;
    private UUID stageId;
    private UUID cardId;

    @BeforeEach
    void setUp() {
        ownerId = UUID.randomUUID();
        member1Id = UUID.randomUUID();
        member2Id = UUID.randomUUID();
        projectId = UUID.randomUUID();
        boardId = UUID.randomUUID();
        stageId = UUID.randomUUID();
        cardId = UUID.randomUUID();

        owner = createMockUser(ownerId, "owner@example.com", "owner", "Project Owner");
        member1 = createMockUser(member1Id, "member1@example.com", "member1", "Member One");
        member2 = createMockUser(member2Id, "member2@example.com", "member2", "Member Two");

        testProject = createMockProject(projectId, owner, "Test Project", "A valid test project description", false);
        testBoard = createMockBoard(boardId, testProject);
        testStage = createMockStage(stageId, "To Do", testBoard, 0);
        testCard = createMockCard(cardId, "Test Card", testStage, 0);
    }

    // =============== Helper Methods for Test Setup ===============

    private User createMockUser(UUID id, String email, String username, String fullName) {
        return User.builder()
            .id(id)
            .email(email)
            .username(username)
            .fullName(fullName)
            .role(User.UserRole.MEMBER)
            .isDeletionMarked(false)
            .createdAt(LocalDateTime.now())
            .build();
    }

    private Project createMockProject(UUID id, User owner, String name, String description, boolean isDeletionMarked) {
        return Project.builder()
            .id(id)
            .owner(owner)
            .name(name)
            .description(description)
            .members(new HashSet<>(Collections.singletonList(owner)))
            .isDeletionMarked(isDeletionMarked)
            .createdAt(LocalDateTime.now())
            .build();
    }

    private Board createMockBoard(UUID id, Project project) {
        Board board = Board.builder()
            .id(id)
            .project(project)
            .name(project.getName())
            .stages(new ArrayList<>())
            .build();
        return board;
    }

    private Stage createMockStage(UUID id, String title, Board board, int position) {
        return Stage.builder()
            .id(id)
            .board(board)
            .title(title)
            .color("#FF0000")
            .position(position)
            .isDeletionMarked(false)
            .cards(new ArrayList<>())
            .createdAt(LocalDateTime.now())
            .build();
    }

    private Card createMockCard(UUID id, String title, Stage stage, int position) {
        return Card.builder()
            .id(id)
            .stage(stage)
            .title(title)
            .description("Test description")
            .priority(Card.Priority.MEDIUM)
            .position(position)
            .isDeletionMarked(false)
            .assignee(null)
            .createdAt(LocalDateTime.now())
            .build();
    }

    // =============== T1: createProject Tests ===============

    @Test
    void createProject_withGenerateTasksTrue_shouldGenerateAiBoardAndBroadcast() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("AI Project")
            .description("This is a five word description here")
            .generateTasks(true)
            .build();

        AIAnalysisResult analysisResult = new AIAnalysisResult();
        Board generatedBoard = createMockBoard(boardId, testProject);

        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "AI Project"))
            .thenReturn(Collections.emptyList());
        when(projectRepository.save(any())).thenReturn(testProject);
        when(aiEngine.analyzeProjectDescription("AI Project", "This is a five word description here"))
            .thenReturn(analysisResult);
        when(boardGenerator.generateBoard(testProject, analysisResult)).thenReturn(generatedBoard);
        when(boardRepository.findByProjectId(projectId)).thenReturn(Collections.singletonList(generatedBoard));
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());

        ProjectDTO result = projectService.createProject(request, owner);

        assertNotNull(result);
        assertEquals("AI Project", result.getName());
        assertEquals(boardId, result.getBoardId());
        verify(projectRepository).save(any());
        verify(projectMemberRepository).upsertMemberRole(projectId, ownerId, "owner");
        verify(aiEngine).analyzeProjectDescription("AI Project", "This is a five word description here");
        verify(boardGenerator).generateBoard(testProject, analysisResult);
        verify(broadcastService).broadcastProjectCreated(any());
    }

    @Test
    void createProject_withGenerateTasksFalse_shouldGenerateEmptyBoard() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("Manual Project")
            .description("Custom description")
            .generateTasks(false)
            .build();

        Board emptyBoard = createMockBoard(boardId, testProject);

        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "Manual Project"))
            .thenReturn(Collections.emptyList());
        when(projectRepository.save(any())).thenReturn(testProject);
        when(boardGenerator.generateEmptyBoard(testProject)).thenReturn(emptyBoard);
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());

        ProjectDTO result = projectService.createProject(request, owner);

        assertNotNull(result);
        assertEquals("Manual Project", result.getName());
        verify(projectRepository).save(any());
        verify(boardGenerator).generateEmptyBoard(testProject);
        verify(aiEngine, never()).analyzeProjectDescription(anyString(), anyString());
        verify(broadcastService).broadcastProjectCreated(any());
    }

    @Test
    void createProject_withNullGenerateTasks_shouldDefaultToTrueAndGenerateAiBoard() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("Default")
            .description("This is a five word desc here")
            .generateTasks(null)
            .build();

        AIAnalysisResult analysisResult = new AIAnalysisResult();
        Board generatedBoard = createMockBoard(boardId, testProject);

        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "Default"))
            .thenReturn(Collections.emptyList());
        when(projectRepository.save(any())).thenReturn(testProject);
        when(aiEngine.analyzeProjectDescription("Default", "This is a five word desc here"))
            .thenReturn(analysisResult);
        when(boardGenerator.generateBoard(testProject, analysisResult)).thenReturn(generatedBoard);
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());
        when(userRepository.findAllById(any())).thenReturn(Collections.singletonList(owner));

        ProjectDTO result = projectService.createProject(request, owner);

        assertNotNull(result);
        verify(aiEngine).analyzeProjectDescription("Default", "This is a five word desc here");
        verify(boardGenerator).generateBoard(testProject, analysisResult);
    }

    @Test
    void createProject_withEmptyName_shouldThrowBadRequest() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("")
            .description("Valid description")
            .build();

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createProject(request, owner);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Project name is required"));
    }

    @Test
    void createProject_withBlankName_shouldThrowBadRequest() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("   ")
            .description("Valid description")
            .build();

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createProject(request, owner);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Project name is required"));
    }

    @Test
    void createProject_withNameExceeding255Chars_shouldThrowBadRequest() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("x".repeat(256))
            .description("Valid description")
            .build();

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createProject(request, owner);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("exceeds maximum length of 255"));
    }

    @Test
    void createProject_withDescriptionExceeding5000Chars_shouldThrowBadRequest() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("Valid")
            .description("x".repeat(5001))
            .build();

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createProject(request, owner);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("exceeds maximum length of 5000"));
    }

    @Test
    void createProject_withInsufficientDescriptionForAiGeneration_shouldThrowBadRequest() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("Valid")
            .description("Only four words")
            .generateTasks(true)
            .build();

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createProject(request, owner);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("at least 5 words"));
    }

    @Test
    void createProject_withDuplicateNameForOwner_shouldThrowConflict() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("Existing")
            .description("Valid description here for the project")
            .generateTasks(false)
            .build();

        Project existingProject = createMockProject(UUID.randomUUID(), owner, "Existing", "Description", false);

        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "Existing"))
            .thenReturn(Collections.singletonList(existingProject));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createProject(request, owner);
        });

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertTrue(exception.getReason().contains("already exists"));
    }

    @Test
    void createProject_withCaseInsensitiveDuplicateName_shouldThrowConflict() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("my project")
            .description("Valid description here for the project")
            .generateTasks(false)
            .build();

        Project existingProject = createMockProject(UUID.randomUUID(), owner, "My Project", "Description", false);

        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "my project"))
            .thenReturn(Collections.singletonList(existingProject));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createProject(request, owner);
        });

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }

    @Test
    void createProject_withNullDescription_shouldAccept() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("Valid")
            .description(null)
            .generateTasks(false)
            .build();

        Board emptyBoard = createMockBoard(boardId, testProject);

        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "Valid"))
            .thenReturn(Collections.emptyList());
        when(projectRepository.save(any())).thenReturn(testProject);
        when(boardGenerator.generateEmptyBoard(testProject)).thenReturn(emptyBoard);
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());
        when(userRepository.findAllById(any())).thenReturn(Collections.singletonList(owner));

        ProjectDTO result = projectService.createProject(request, owner);

        assertNotNull(result);
        verify(projectRepository).save(any());
    }

    @Test
    void createProject_shouldAddOwnerAsMemberWithOwnerRole() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("Valid")
            .description("Valid description")
            .generateTasks(false)
            .build();

        Board emptyBoard = createMockBoard(boardId, testProject);

        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "Valid"))
            .thenReturn(Collections.emptyList());
        when(projectRepository.save(any())).thenReturn(testProject);
        when(boardGenerator.generateEmptyBoard(testProject)).thenReturn(emptyBoard);
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());

        projectService.createProject(request, owner);

        ArgumentCaptor<String> roleCaptor = ArgumentCaptor.forClass(String.class);
        verify(projectMemberRepository).upsertMemberRole(eq(projectId), eq(ownerId), roleCaptor.capture());
        assertEquals("owner", roleCaptor.getValue());
    }

    @Test
    void createProject_shouldBroadcastCreationEvent() {
        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("Valid")
            .description("Valid description")
            .generateTasks(false)
            .build();

        Board emptyBoard = createMockBoard(boardId, testProject);

        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "Valid"))
            .thenReturn(Collections.emptyList());
        when(projectRepository.save(any())).thenReturn(testProject);
        when(boardGenerator.generateEmptyBoard(testProject)).thenReturn(emptyBoard);
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());
        when(userRepository.findAllById(any())).thenReturn(Collections.singletonList(owner));

        projectService.createProject(request, owner);

        verify(broadcastService).broadcastProjectCreated(any(ProjectDTO.class));
    }

    // =============== T2: getProject Tests ===============

    @Test
    void getProject_withValidProjectIdAndRequester_shouldReturnProjectDTO() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(boardRepository.findByProjectId(projectId)).thenReturn(Collections.singletonList(testBoard));
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());

        ProjectDTO result = projectService.getProject(projectId, ownerId);

        assertNotNull(result);
        assertEquals(projectId, result.getId());
        assertEquals("Test Project", result.getName());
        verify(projectRepository).findById(projectId);
    }

    @Test
    void getProject_withNonexistentProject_shouldThrowNotFound() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.getProject(projectId, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Project not found"));
    }

    @Test
    void getProject_withDeletedProject_shouldThrowNotFound() {
        Project deletedProject = createMockProject(projectId, owner, "Test Project", "Description", true);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(deletedProject));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.getProject(projectId, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void getProject_withNonMemberUser_shouldThrowForbidden() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.getProject(projectId, member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
        assertTrue(exception.getReason().contains("do not have access"));
    }

    @Test
    void getProject_withNoBoardExists_shouldReturnProjectWithNullBoardId() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(boardRepository.findByProjectId(projectId)).thenReturn(Collections.emptyList());
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));
        when(userRepository.findAllById(any())).thenReturn(Collections.singletonList(owner));

        ProjectDTO result = projectService.getProject(projectId, ownerId);

        assertNotNull(result);
        assertNull(result.getBoardId());
        assertTrue(result.getColumns().isEmpty());
    }

    @Test
    void getProject_withMultipleStagesAndCards_shouldBuildCompleteStructure() {
        Stage stage2 = createMockStage(UUID.randomUUID(), "In Progress", testBoard, 1);
        testCard.setStage(testStage);
        testStage.getCards().add(testCard);
        testBoard.getStages().addAll(Arrays.asList(testStage, stage2));

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(boardRepository.findByProjectId(projectId)).thenReturn(Collections.singletonList(testBoard));
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());

        ProjectDTO result = projectService.getProject(projectId, ownerId);

        assertNotNull(result);
        assertEquals(2, result.getColumns().size());
        assertTrue(result.getTasks().size() > 0);
    }

    // =============== T3: getUserProjects Tests ===============

    @Test
    void getUserProjects_withValidUserAndMultipleProjects_shouldReturnAllProjects() {
        Project project2 = createMockProject(UUID.randomUUID(), owner, "Project 2", "Description", false);

        when(userRepository.existsById(ownerId)).thenReturn(true);
        when(projectRepository.findActiveProjectsForUserId(ownerId))
            .thenReturn(Arrays.asList(testProject, project2));
        when(boardRepository.findByProjectId(testProject.getId()))
            .thenReturn(Collections.singletonList(testBoard));
        when(boardRepository.findByProjectId(project2.getId()))
            .thenReturn(Collections.singletonList(createMockBoard(UUID.randomUUID(), project2)));
        when(projectMemberRepository.findProjectMemberRoles(any())).thenReturn(new ArrayList<>());

        List<ProjectDTO> results = projectService.getUserProjects(ownerId);

        assertNotNull(results);
        assertEquals(2, results.size());
        verify(userRepository).existsById(ownerId);
        verify(projectRepository).findActiveProjectsForUserId(ownerId);
    }

    @Test
    void getUserProjects_withNonexistentUser_shouldThrowNotFound() {
        when(userRepository.existsById(member1Id)).thenReturn(false);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.getUserProjects(member1Id);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertTrue(exception.getReason().contains("User not found"));
    }

    @Test
    void getUserProjects_withNoProjects_shouldReturnEmptyList() {
        when(userRepository.existsById(member1Id)).thenReturn(true);
        when(projectRepository.findActiveProjectsForUserId(member1Id))
            .thenReturn(Collections.emptyList());

        List<ProjectDTO> results = projectService.getUserProjects(member1Id);

        assertNotNull(results);
        assertTrue(results.isEmpty());
    }

    @Test
    void getUserProjects_shouldIncludeStagesAndCards() {
        testStage.getCards().add(testCard);
        testBoard.getStages().add(testStage);

        when(userRepository.existsById(ownerId)).thenReturn(true);
        when(projectRepository.findActiveProjectsForUserId(ownerId))
            .thenReturn(Collections.singletonList(testProject));
        when(boardRepository.findByProjectId(projectId))
            .thenReturn(Collections.singletonList(testBoard));
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());

        List<ProjectDTO> results = projectService.getUserProjects(ownerId);

        assertNotNull(results);
        assertTrue(results.get(0).getColumns().size() > 0);
    }

    // =============== T4: updateProject Tests ===============

    @Test
    void updateProject_withNewName_shouldUpdateNameAndBroadcast() {
        UpdateProjectRequest request = UpdateProjectRequest.builder()
            .name("Updated Name")
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));
        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "Updated Name"))
            .thenReturn(Collections.emptyList());
        when(projectRepository.save(any())).thenReturn(testProject);
        when(boardRepository.findByProjectId(projectId)).thenReturn(Collections.singletonList(testBoard));
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());
        when(userRepository.findAllById(any())).thenReturn(Collections.singletonList(owner));

        ProjectDTO result = projectService.updateProject(projectId, ownerId, request);

        assertNotNull(result);
        verify(projectRepository).save(any());
        verify(broadcastService).broadcastProjectUpdated(eq(projectId), any(ProjectDTO.class));
    }

    @Test
    void updateProject_withNewDescription_shouldUpdateDescription() {
        UpdateProjectRequest request = UpdateProjectRequest.builder()
            .description("New description")
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));
        when(projectRepository.save(any())).thenReturn(testProject);
        when(boardRepository.findByProjectId(projectId)).thenReturn(Collections.singletonList(testBoard));
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());
        when(userRepository.findAllById(any())).thenReturn(Collections.singletonList(owner));

        projectService.updateProject(projectId, ownerId, request);

        verify(projectRepository).save(any());
    }

    @Test
    void updateProject_withNullName_shouldKeepExistingName() {
        UpdateProjectRequest request = UpdateProjectRequest.builder()
            .name(null)
            .build();

        String originalName = testProject.getName();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));
        when(projectRepository.save(any())).thenReturn(testProject);
        when(boardRepository.findByProjectId(projectId)).thenReturn(Collections.singletonList(testBoard));
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());
        when(userRepository.findAllById(any())).thenReturn(Collections.singletonList(owner));

        projectService.updateProject(projectId, ownerId, request);

        assertEquals(originalName, testProject.getName());
    }

    @Test
    void updateProject_withNullDescription_shouldKeepExistingDescription() {
        UpdateProjectRequest request = UpdateProjectRequest.builder()
            .description(null)
            .build();

        String originalDesc = testProject.getDescription();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));
        when(projectRepository.save(any())).thenReturn(testProject);
        when(boardRepository.findByProjectId(projectId)).thenReturn(Collections.singletonList(testBoard));
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());

        projectService.updateProject(projectId, ownerId, request);

        assertEquals(originalDesc, testProject.getDescription());
    }

    @Test
    void updateProject_withNameExceeding255Chars_shouldThrowBadRequest() {
        UpdateProjectRequest request = UpdateProjectRequest.builder()
            .name("x".repeat(256))
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateProject(projectId, ownerId, request);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }

    @Test
    void updateProject_withDuplicateNameForOwner_shouldThrowConflict() {
        UpdateProjectRequest request = UpdateProjectRequest.builder()
            .name("Existing")
            .build();

        Project existingProject = createMockProject(UUID.randomUUID(), owner, "Existing", "Description", false);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));
        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "Existing"))
            .thenReturn(Collections.singletonList(existingProject));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateProject(projectId, ownerId, request);
        });

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }

    @Test
    void updateProject_withEditorAttemptingUpdate_shouldThrowForbidden() {
        UpdateProjectRequest request = UpdateProjectRequest.builder()
            .name("New Name")
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("editor"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateProject(projectId, member1Id, request);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void updateProject_withNonexistentProject_shouldThrowNotFound() {
        UpdateProjectRequest request = UpdateProjectRequest.builder()
            .name("New Name")
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateProject(projectId, ownerId, request);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void updateProject_shouldBroadcastUpdateEvent() {
        UpdateProjectRequest request = UpdateProjectRequest.builder()
            .name("Updated")
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));
        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "Updated"))
            .thenReturn(Collections.emptyList());
        when(projectRepository.save(any())).thenReturn(testProject);
        when(boardRepository.findByProjectId(projectId)).thenReturn(Collections.singletonList(testBoard));
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());

        projectService.updateProject(projectId, ownerId, request);

        verify(broadcastService).broadcastProjectUpdated(eq(projectId), any(ProjectDTO.class));
    }

    // =============== T5: deleteProject Tests ===============

    @Test
    void deleteProject_asOwner_shouldMarkForDeletion() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());

        projectService.deleteProject(projectId, ownerId);

        assertTrue(testProject.getIsDeletionMarked());
        verify(projectRepository).save(testProject);
    }

    @Test
    void deleteProject_asNonOwner_shouldThrowForbidden() {
        Project ownerProject = createMockProject(projectId, owner, "Test", "Description", false);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(ownerProject));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("editor"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.deleteProject(projectId, member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Only project owner"));
    }

    @Test
    void deleteProject_withNonexistentProject_shouldThrowNotFound() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.deleteProject(projectId, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void deleteProject_shouldBroadcastDeletionEvent() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());

        projectService.deleteProject(projectId, ownerId);

        verify(broadcastService).broadcastProjectDeleted(projectId);
    }

    // =============== T6: createCard Tests ===============

    @Test
    void createCard_withValidInput_shouldCreateCardAtEndOfStage() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("editor"));
        when(cardRepository.save(any())).thenReturn(testCard);

        CardDTO result = projectService.createCard(stageId, "Test Card", "Details", "HIGH", null, ownerId);

        assertNotNull(result);
        assertEquals("Test Card", result.getTitle());
        assertEquals("MEDIUM", result.getPriority()); // Mock returns medium
        verify(cardRepository).save(any());
        verify(broadcastService).broadcastCardCreated(anyUUID(), anyUUID(), any(CardDTO.class));
    }

    @Test
    void createCard_withNonexistentStage_shouldThrowNotFound() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createCard(stageId, "Title", "Desc", "HIGH", null, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Stage not found"));
    }

    @Test
    void createCard_withDeletedStage_shouldThrowNotFound() {
        Stage deletedStage = createMockStage(stageId, "To Do", testBoard, 0);
        deletedStage.setIsDeletionMarked(true);

        when(stageRepository.findById(stageId)).thenReturn(Optional.of(deletedStage));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createCard(stageId, "Title", "Desc", "HIGH", null, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void createCard_withEmptyTitle_shouldThrowBadRequest() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createCard(stageId, "", "Desc", "HIGH", null, ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("title is required"));
    }

    @Test
    void createCard_withTitleExceeding255Chars_shouldThrowBadRequest() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createCard(stageId, "x".repeat(256), "Desc", "HIGH", null, ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("exceeds maximum length"));
    }

    @Test
    void createCard_withNullDescription_shouldAcceptOptionalField() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("editor"));
        when(cardRepository.save(any())).thenReturn(testCard);

        CardDTO result = projectService.createCard(stageId, "Title", null, "HIGH", null, ownerId);

        assertNotNull(result);
        verify(cardRepository).save(any());
    }

    @Test
    void createCard_withInvalidPriority_shouldThrowBadRequest() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createCard(stageId, "Title", "Desc", "URGENT", null, ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Priority must be"));
    }

    @Test
    void createCard_withNonMemberAssignee_shouldThrowBadRequest() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createCard(stageId, "Title", "Desc", "HIGH", member1Id, ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Assignee must be a project member"));
    }

    @Test
    void createCard_withOwnerAsAssignee_shouldAccept() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        CardDTO result = projectService.createCard(stageId, "Title", "Desc", "HIGH", ownerId, ownerId);

        assertNotNull(result);
        verify(cardRepository).save(any());
    }

    @Test
    void createCard_withNullAssignee_shouldAcceptUnassigned() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        CardDTO result = projectService.createCard(stageId, "Title", "Desc", "HIGH", null, ownerId);

        assertNotNull(result);
        verify(cardRepository).save(any());
    }

    @Test
    void createCard_withViewerUser_shouldThrowForbidden() {
        Object[] roleRow = {member1Id, "viewer"};
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("viewer"));
        when(projectMemberRepository.findProjectMemberRoles(projectId))
            .thenReturn(Collections.singletonList(roleRow));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createCard(stageId, "Title", "Desc", "HIGH", null, member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Viewer role is read-only"));
    }

    @Test
    void createCard_shouldBroadcastCreation() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        projectService.createCard(stageId, "Title", "Desc", "HIGH", null, ownerId);

        verify(broadcastService).broadcastCardCreated(boardId, stageId, any(CardDTO.class));
    }

    // =============== T7: updateCard Tests ===============

    @Test
    void updateCard_withValidInput_shouldUpdateAllFields() {
        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        CardDTO result = projectService.updateCard(cardId, "New Title", "New Desc", "CRITICAL", null, ownerId);

        assertNotNull(result);
        verify(cardRepository).save(any());
    }

    @Test
    void updateCard_withNullTitle_shouldThrowBadRequest() {
        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateCard(cardId, null, "Desc", "HIGH", null, ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }

    @Test
    void updateCard_withNullPriority_shouldSkipPriorityUpdate() {
        Card.Priority originalPriority = testCard.getPriority();

        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        projectService.updateCard(cardId, "Title", "Desc", null, null, ownerId);

        assertEquals(originalPriority, testCard.getPriority());
    }

    @Test
    void updateCard_withNonexistentCard_shouldThrowNotFound() {
        when(cardRepository.findById(cardId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateCard(cardId, "Title", "Desc", "HIGH", null, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void updateCard_withDeletedCard_shouldThrowNotFound() {
        Card deletedCard = createMockCard(cardId, "Title", testStage, 0);
        deletedCard.setIsDeletionMarked(true);

        when(cardRepository.findById(cardId)).thenReturn(Optional.of(deletedCard));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateCard(cardId, "Title", "Desc", "HIGH", null, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void updateCard_withViewerUser_shouldThrowForbidden() {
        Object[] roleRow = {member1Id, "viewer"};
        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("viewer"));
        when(projectMemberRepository.findProjectMemberRoles(projectId))
            .thenReturn(Collections.singletonList(roleRow));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateCard(cardId, "Title", "Desc", "HIGH", null, member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void updateCard_shouldBroadcastUpdate() {
        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        projectService.updateCard(cardId, "New Title", "New Desc", "HIGH", null, ownerId);

        verify(broadcastService).broadcastCardUpdated(boardId, stageId, any(CardDTO.class));
    }

    // =============== T8: moveCard Tests ===============

    @Test
    void moveCard_toAnotherStage_shouldUpdateStageAndPosition() {
        Stage targetStage = createMockStage(UUID.randomUUID(), "Done", testBoard, 2);
        targetStage.setCards(new ArrayList<>());

        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(stageRepository.findById(targetStage.getId())).thenReturn(Optional.of(targetStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        CardDTO result = projectService.moveCard(cardId, targetStage.getId(), ownerId);

        assertNotNull(result);
        verify(cardRepository).save(any());
    }

    @Test
    void moveCard_withNonexistentCard_shouldThrowNotFound() {
        when(cardRepository.findById(cardId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.moveCard(cardId, UUID.randomUUID(), ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Card not found"));
    }

    @Test
    void moveCard_withNonexistentTargetStage_shouldThrowNotFound() {
        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(stageRepository.findById(any())).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.moveCard(cardId, UUID.randomUUID(), ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Target stage not found"));
    }

    @Test
    void moveCard_withDeletedTargetStage_shouldThrowNotFound() {
        Stage deletedStage = createMockStage(UUID.randomUUID(), "Done", testBoard, 2);
        deletedStage.setIsDeletionMarked(true);

        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(stageRepository.findById(deletedStage.getId())).thenReturn(Optional.of(deletedStage));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.moveCard(cardId, deletedStage.getId(), ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void moveCard_acrossProjects_shouldThrowBadRequest() {
        Project project2 = createMockProject(UUID.randomUUID(), owner, "Project 2", "Description", false);
        Board board2 = createMockBoard(UUID.randomUUID(), project2);
        Stage stage2 = createMockStage(UUID.randomUUID(), "To Do", board2, 0);

        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(stageRepository.findById(stage2.getId())).thenReturn(Optional.of(stage2));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.moveCard(cardId, stage2.getId(), ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Cannot move card across projects"));
    }

    @Test
    void moveCard_shouldAdjustPositionInOldStage() {
        Card card1 = createMockCard(UUID.randomUUID(), "Card1", testStage, 0);
        Card card2 = createMockCard(UUID.randomUUID(), "Card2", testStage, 1);
        Card card3 = createMockCard(UUID.randomUUID(), "Card3", testStage, 2);

        testStage.getCards().addAll(Arrays.asList(card1, card2, card3));

        Stage targetStage = createMockStage(UUID.randomUUID(), "Done", testBoard, 1);
        targetStage.setCards(new ArrayList<>());

        when(cardRepository.findById(card2.getId())).thenReturn(Optional.of(card2));
        when(stageRepository.findById(targetStage.getId())).thenReturn(Optional.of(targetStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(card2);

        projectService.moveCard(card2.getId(), targetStage.getId(), ownerId);

        verify(cardRepository, atLeast(1)).save(any());
    }

    @Test
    void moveCard_withViewerUser_shouldThrowForbidden() {
        Object[] roleRow = {member1Id, "viewer"};
        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(stageRepository.findById(any())).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("viewer"));
        when(projectMemberRepository.findProjectMemberRoles(projectId))
            .thenReturn(Collections.singletonList(roleRow));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.moveCard(cardId, stageId, member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void moveCard_shouldBroadcastMovement() {
        Stage targetStage = createMockStage(UUID.randomUUID(), "Done", testBoard, 2);
        targetStage.setCards(new ArrayList<>());

        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(stageRepository.findById(targetStage.getId())).thenReturn(Optional.of(targetStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        projectService.moveCard(cardId, targetStage.getId(), ownerId);

        verify(broadcastService).broadcastCardMoved(eq(boardId), eq(stageId), eq(targetStage.getId()), 
                                                     any(CardDTO.class), anyInt());
    }

    // =============== T9: deleteCard Tests ===============

    @Test
    void deleteCard_shouldMarkForDeletion() {
        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());

        projectService.deleteCard(cardId, ownerId);

        assertTrue(testCard.getIsDeletionMarked());
        verify(cardRepository).save(testCard);
    }

    @Test
    void deleteCard_withNonexistentCard_shouldThrowNotFound() {
        when(cardRepository.findById(cardId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.deleteCard(cardId, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void deleteCard_withAlreadyDeletedCard_shouldThrowNotFound() {
        Card deletedCard = createMockCard(cardId, "Title", testStage, 0);
        deletedCard.setIsDeletionMarked(true);

        when(cardRepository.findById(cardId)).thenReturn(Optional.of(deletedCard));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.deleteCard(cardId, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void deleteCard_withViewerUser_shouldThrowForbidden() {
        Object[] roleRow = {member1Id, "viewer"};
        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("viewer"));
        when(projectMemberRepository.findProjectMemberRoles(projectId))
            .thenReturn(Collections.singletonList(roleRow));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.deleteCard(cardId, member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void deleteCard_shouldBroadcastDeletion() {
        when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());

        projectService.deleteCard(cardId, ownerId);

        verify(broadcastService).broadcastCardDeleted(boardId, stageId, cardId);
    }

    // =============== T10: addStage Tests ===============

    @Test
    void addStage_shouldCreateStageAtEndOfBoard() {
        testBoard.setStages(new ArrayList<>()); // Start with 2 stages

        when(boardRepository.findById(boardId)).thenReturn(Optional.of(testBoard));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(stageRepository.save(any())).thenReturn(testStage);

        StageDTO result = projectService.addStage(boardId, "In Progress", "#00FF00", ownerId);

        assertNotNull(result);
        verify(stageRepository).save(any());
    }

    @Test
    void addStage_withNonexistentBoard_shouldThrowNotFound() {
        when(boardRepository.findById(boardId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.addStage(boardId, "In Progress", "#00FF00", ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Board not found"));
    }

    @Test
    void addStage_withDeletedBoard_shouldThrowNotFound() {
        Board deletedBoard = createMockBoard(boardId, testProject);
        deletedBoard.setIsDeletionMarked(true);

        when(boardRepository.findById(boardId)).thenReturn(Optional.of(deletedBoard));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.addStage(boardId, "In Progress", "#FF0000", ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void addStage_withEmptyTitle_shouldThrowBadRequest() {
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(testBoard));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.addStage(boardId, "", "#FF0000", ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Stage title is required"));
    }

    @Test
    void addStage_withTitleExceeding100Chars_shouldThrowBadRequest() {
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(testBoard));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.addStage(boardId, "x".repeat(101), "#FF0000", ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("exceeds maximum length of 100"));
    }

    @Test
    void addStage_withViewerUser_shouldThrowForbidden() {
        Object[] roleRow = {member1Id, "viewer"};
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(testBoard));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("viewer"));
        when(projectMemberRepository.findProjectMemberRoles(projectId))
            .thenReturn(Collections.singletonList(roleRow));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.addStage(boardId, "New Stage", "#FF0000", member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void addStage_shouldBroadcastCreation() {
        when(boardRepository.findById(boardId)).thenReturn(Optional.of(testBoard));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(stageRepository.save(any())).thenReturn(testStage);

        projectService.addStage(boardId, "New Stage", "#FF0000", ownerId);

        verify(broadcastService).broadcastStageCreated(eq(boardId), any(StageDTO.class));
    }

    // =============== T11: deleteStage Tests ===============

    @Test
    void deleteStage_shouldMarkForDeletion() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());

        projectService.deleteStage(stageId, ownerId);

        assertTrue(testStage.getIsDeletionMarked());
        verify(stageRepository).save(testStage);
    }

    @Test
    void deleteStage_withNonexistentStage_shouldThrowNotFound() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.deleteStage(stageId, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void deleteStage_withAlreadyDeletedStage_shouldThrowNotFound() {
        Stage deletedStage = createMockStage(stageId, "To Do", testBoard, 0);
        deletedStage.setIsDeletionMarked(true);

        when(stageRepository.findById(stageId)).thenReturn(Optional.of(deletedStage));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.deleteStage(stageId, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void deleteStage_withViewerUser_shouldThrowForbidden() {
        Object[] roleRow = {member1Id, "viewer"};
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("viewer"));
        when(projectMemberRepository.findProjectMemberRoles(projectId))
            .thenReturn(Collections.singletonList(roleRow));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.deleteStage(stageId, member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void deleteStage_shouldBroadcastDeletion() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());

        projectService.deleteStage(stageId, ownerId);

        verify(broadcastService).broadcastStageDeleted(boardId, stageId);
    }

    // =============== T12: renameStage Tests ===============

    @Test
    void renameStage_withNewTitle_shouldUpdateTitleAndBroadcast() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(stageRepository.save(any())).thenReturn(testStage);

        StageDTO result = projectService.renameStage(stageId, "In Review", ownerId);

        assertNotNull(result);
        verify(stageRepository).save(any());
        verify(broadcastService).broadcastStageUpdated(boardId, any(StageDTO.class));
    }

    @Test
    void renameStage_withEmptyTitle_shouldThrowBadRequest() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.renameStage(stageId, "", ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Stage title is required"));
    }

    @Test
    void renameStage_withTitleExceeding100Chars_shouldThrowBadRequest() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.renameStage(stageId, "x".repeat(101), ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("exceeds maximum length of 100"));
    }

    @Test
    void renameStage_withNonexistentStage_shouldThrowNotFound() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.renameStage(stageId, "New Title", ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void renameStage_withDeletedStage_shouldThrowNotFound() {
        Stage deletedStage = createMockStage(stageId, "To Do", testBoard, 0);
        deletedStage.setIsDeletionMarked(true);

        when(stageRepository.findById(stageId)).thenReturn(Optional.of(deletedStage));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.renameStage(stageId, "New Name", ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void renameStage_withViewerUser_shouldThrowForbidden() {
        Object[] roleRow = {member1Id, "viewer"};
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("viewer"));
        when(projectMemberRepository.findProjectMemberRoles(projectId))
            .thenReturn(Collections.singletonList(roleRow));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.renameStage(stageId, "New Name", member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    // =============== T13: getProjectMembers Tests ===============

    @Test
    void getProjectMembers_shouldReturnMembersSortedByRoleThenName() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());

        Object[] ownerRole = {ownerId, "owner"};
        Object[] editor1Role = {member1Id, "editor"};
        Object[] editor2Role = {member2Id, "viewer"};

        when(projectMemberRepository.findProjectMemberRoles(projectId))
            .thenReturn(Arrays.asList(ownerRole, editor1Role, editor2Role));

        when(userRepository.findAllById(anyCollection()))
            .thenReturn(Arrays.asList(owner, member1, member2));

        List<TeamMemberDTO> results = projectService.getProjectMembers(projectId, ownerId);

        assertNotNull(results);
        assertEquals(3, results.size());
        assertEquals("owner", results.get(0).getRole());
    }

    @Test
    void getProjectMembers_withNonexistentProject_shouldThrowNotFound() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.getProjectMembers(projectId, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void getProjectMembers_withNonMemberUser_shouldThrowForbidden() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.getProjectMembers(projectId, member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    // =============== T14: addTeamMember Tests ===============

    @Test
    void addTeamMember_withNewMember_shouldAddAsEditor() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("new@example.com")).thenReturn(Optional.of(member1));
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());
        when(userRepository.findAllById(any())).thenReturn(Collections.singletonList(member1));

        TeamMemberDTO result = projectService.addTeamMember(projectId, "new@example.com", "editor", ownerId);

        assertNotNull(result);
        assertEquals("editor", result.getRole());
        verify(projectMemberRepository).upsertMemberRole(projectId, member1Id, "editor");
        verify(broadcastService).broadcastTeamMemberAdded(eq(projectId), any(TeamMemberDTO.class));
    }

    @Test
    void addTeamMember_withNonexistentProject_shouldThrowNotFound() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.addTeamMember(projectId, "new@example.com", "editor", ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void addTeamMember_withNonOwnerUser_shouldThrowForbidden() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("editor"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.addTeamMember(projectId, "new@example.com", "editor", member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Only project owner"));
    }

    @Test
    void addTeamMember_withOwnerRoleRequest_shouldThrowBadRequest() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.addTeamMember(projectId, "new@example.com", "owner", ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Cannot add another owner"));
    }

    @Test
    void addTeamMember_withNonexistentUser_shouldThrowNotFound() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));
        when(userRepository.findByEmailIgnoreCase("nonexistent@example.com")).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.addTeamMember(projectId, "nonexistent@example.com", "editor", ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertTrue(exception.getReason().contains("User not found"));
    }

    @Test
    void addTeamMember_withDeletedUser_shouldThrowBadRequest() {
        User deletedUser = createMockUser(member1Id, "deleted@example.com", "user", "User");
        deletedUser.setIsDeletionMarked(true);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("deleted@example.com")).thenReturn(Optional.of(deletedUser));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.addTeamMember(projectId, "deleted@example.com", "editor", ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Cannot add deleted user"));
    }

    @Test
    void addTeamMember_withAlreadyMember_shouldThrowConflict() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("member1@example.com")).thenReturn(Optional.of(member1));
        when(projectMemberRepository.findProjectMemberRoles(projectId))
            .thenReturn(Collections.singletonList(new Object[]{member1Id, "editor"}));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.addTeamMember(projectId, "member1@example.com", "editor", ownerId);
        });

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertTrue(exception.getReason().contains("already a member"));
    }

    @Test
    void addTeamMember_withCaseInsensitiveEmail_shouldNormalizeAndAdd() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("new@example.com")).thenReturn(Optional.of(member1));
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(new ArrayList<>());
        when(userRepository.findAllById(any())).thenReturn(Collections.singletonList(member1));

        projectService.addTeamMember(projectId, "New@Example.COM", "editor", ownerId);

        verify(userRepository).findByEmailIgnoreCase("new@example.com");
    }

    // =============== T15: updateTeamMemberRole Tests ===============

    @Test
    void updateTeamMemberRole_withValidRole_shouldUpdateRole() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("editor"));
        when(userRepository.findById(member1Id)).thenReturn(Optional.of(member1));

        TeamMemberDTO result = projectService.updateTeamMemberRole(projectId, member1Id, "viewer", ownerId);

        assertNotNull(result);
        verify(projectMemberRepository).upsertMemberRole(projectId, member1Id, "viewer");
        verify(broadcastService).broadcastTeamMemberRoleChanged(projectId, member1Id, "viewer");
    }

    @Test
    void updateTeamMemberRole_attemptingSelfUpdate_shouldThrowBadRequest() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateTeamMemberRole(projectId, ownerId, "viewer", ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("cannot update your own role"));
    }

    @Test
    void updateTeamMemberRole_attemptingToChangeOwnerRole_shouldThrowBadRequest() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateTeamMemberRole(projectId, ownerId, "editor", ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Cannot update project owner role") || exception.getReason().contains("cannot update your own role"));
    }

    @Test
    void updateTeamMemberRole_assigningOwnerRole_shouldThrowBadRequest() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("editor"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateTeamMemberRole(projectId, member1Id, "owner", ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Cannot assign owner role"));
    }

    @Test
    void updateTeamMemberRole_withNonMember_shouldThrowNotFound() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateTeamMemberRole(projectId, member1Id, "viewer", ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertTrue(exception.getReason().contains("not a member"));
    }

    @Test
    void updateTeamMemberRole_withNonexistentTargetUser_shouldThrowNotFound() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("editor"));
        when(userRepository.findById(member1Id)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateTeamMemberRole(projectId, member1Id, "viewer", ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertTrue(exception.getReason().contains("User not found"));
    }

    @Test
    void updateTeamMemberRole_withNonOwnerRequester_shouldThrowForbidden() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("editor"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.updateTeamMemberRole(projectId, member2Id, "viewer", member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Only project owner"));
    }

    // =============== T16: removeTeamMember Tests ===============

    @Test
    void removeTeamMember_withValidMember_shouldRemove() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("editor"));

        projectService.removeTeamMember(projectId, member1Id, ownerId);

        verify(projectMemberRepository).deleteMember(projectId, member1Id);
        verify(broadcastService).broadcastTeamMemberRemoved(projectId, member1Id);
    }

    @Test
    void removeTeamMember_attemptingToRemoveSelf_shouldThrowBadRequest() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.removeTeamMember(projectId, ownerId, ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("cannot remove yourself"));
    }

    @Test
    void removeTeamMember_attemptingToRemoveOwner_shouldThrowBadRequest() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.of("owner"));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("editor"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.removeTeamMember(projectId, ownerId, ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("cannot remove yourself"));
    }

    @Test
    void removeTeamMember_withNonMember_shouldThrowNotFound() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.removeTeamMember(projectId, member1Id, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertTrue(exception.getReason().contains("not a member"));
    }

    @Test
    void removeTeamMember_withNonOwnerRequester_shouldThrowForbidden() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(testProject));
        when(projectMemberRepository.findMemberRole(projectId, member1Id)).thenReturn(Optional.of("editor"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.removeTeamMember(projectId, member2Id, member1Id);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Only project owner"));
    }

    @Test
    void removeTeamMember_withNonexistentProject_shouldThrowNotFound() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.removeTeamMember(projectId, member1Id, ownerId);
        });

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    // =============== Priority Parsing Tests ===============

    @Test
    void parsePriority_withLowValue_shouldReturnLow() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        projectService.createCard(stageId, "Title", "Desc", "low", null, ownerId);

        verify(cardRepository).save(any());
    }

    @Test
    void parsePriority_withMediumValue_shouldReturnMedium() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        projectService.createCard(stageId, "Title", "Desc", "medium", null, ownerId);

        verify(cardRepository).save(any());
    }

    @Test
    void parsePriority_withHighValue_shouldReturnHigh() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        projectService.createCard(stageId, "Title", "Desc", "high", null, ownerId);

        verify(cardRepository).save(any());
    }

    @Test
    void parsePriority_withCriticalValue_shouldReturnCritical() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        projectService.createCard(stageId, "Title", "Desc", "critical", null, ownerId);

        verify(cardRepository).save(any());
    }

    @Test
    void parsePriority_withCaseInsensitiveValue_shouldBeCaseInsensitive() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));
        when(projectMemberRepository.findMemberRole(projectId, ownerId)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenReturn(testCard);

        projectService.createCard(stageId, "Title", "Desc", "MeDiUm", null, ownerId);

        verify(cardRepository).save(any());
    }

    @Test
    void parsePriority_withInvalidValue_shouldThrowBadRequest() {
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(testStage));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> {
            projectService.createCard(stageId, "Title", "Desc", "INVALID", null, ownerId);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Priority must be"));
    }

    private UUID anyUUID() {
        return any(UUID.class);
    }
}
