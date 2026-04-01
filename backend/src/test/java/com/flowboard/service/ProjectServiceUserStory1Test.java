package com.flowboard.service;

import com.flowboard.dto.AIAnalysisResult;
import com.flowboard.dto.CreateProjectRequest;
import com.flowboard.dto.ProjectDTO;
import com.flowboard.entity.Board;
import com.flowboard.entity.Project;
import com.flowboard.entity.User;
import com.flowboard.repository.BoardRepository;
import com.flowboard.repository.CardRepository;
import com.flowboard.repository.ProjectMemberRepository;
import com.flowboard.repository.ProjectRepository;
import com.flowboard.repository.StageRepository;
import com.flowboard.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectServiceUserStory1Test {

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

    @Test
    void createProject_withGenerateTasksTrue_callsAiAndBoardGeneratorApis() {
        UUID ownerId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID boardId = UUID.randomUUID();

        User owner = User.builder()
            .id(ownerId)
            .email("pm@flowboard.com")
            .username("pm")
            .fullName("Project Manager")
            .role(User.UserRole.MANAGER)
            .build();

        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("Website Redesign")
            .description("Redesign company website with modern UI UX and improved navigation")
            .generateTasks(true)
            .build();

        Project savedProject = Project.builder()
            .id(projectId)
            .name("Website Redesign")
            .description("Redesign company website with modern UI UX and improved navigation")
            .owner(owner)
            .members(Collections.singleton(owner))
            .isDeletionMarked(false)
            .build();

        Board generatedBoard = Board.builder()
            .id(boardId)
            .name("Website Redesign Board")
            .project(savedProject)
            .stages(Collections.emptyList())
            .build();

        AIAnalysisResult analysisResult = new AIAnalysisResult();
        analysisResult.setStages(Collections.emptyList());
        analysisResult.setTasks(Collections.emptyList());

        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "Website Redesign")).thenReturn(Collections.emptyList());
        when(projectRepository.save(any(Project.class))).thenReturn(savedProject);
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(Collections.emptyList());
        when(userRepository.findAllById(any())).thenReturn(List.of(owner));
        when(aiEngine.analyzeProjectDescription(
            eq("Website Redesign"),
            eq("Redesign company website with modern UI UX and improved navigation")
        )).thenReturn(analysisResult);
        when(boardGenerator.generateBoard(savedProject, analysisResult)).thenReturn(generatedBoard);

        ProjectDTO result = projectService.createProject(request, owner);

        assertNotNull(result);
        assertEquals(projectId, result.getId());
        assertEquals(boardId, result.getBoardId());

        verify(aiEngine).analyzeProjectDescription(
            "Website Redesign",
            "Redesign company website with modern UI UX and improved navigation"
        );
        verify(boardGenerator).generateBoard(savedProject, analysisResult);
        verify(boardGenerator, never()).generateEmptyBoard(any(Project.class));
    }

    @Test
    void createProject_withGenerateTasksFalse_skipsAi_andUsesEmptyBoardApi() {
        UUID ownerId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID boardId = UUID.randomUUID();

        User owner = User.builder()
            .id(ownerId)
            .email("pm@flowboard.com")
            .username("pm")
            .fullName("Project Manager")
            .role(User.UserRole.MANAGER)
            .build();

        CreateProjectRequest request = CreateProjectRequest.builder()
            .name("Backlog Setup")
            .description("Short description that should be ignored")
            .generateTasks(false)
            .build();

        Project savedProject = Project.builder()
            .id(projectId)
            .name("Backlog Setup")
            .description("Short description that should be ignored")
            .owner(owner)
            .members(Collections.singleton(owner))
            .isDeletionMarked(false)
            .build();

        Board emptyBoard = Board.builder()
            .id(boardId)
            .name("Backlog Setup Board")
            .project(savedProject)
            .stages(Collections.emptyList())
            .build();

        when(projectRepository.findActiveByOwnerAndNameIgnoreCase(owner, "Backlog Setup")).thenReturn(Collections.emptyList());
        when(projectRepository.save(any(Project.class))).thenReturn(savedProject);
        when(projectMemberRepository.findProjectMemberRoles(projectId)).thenReturn(Collections.emptyList());
        when(userRepository.findAllById(any())).thenReturn(List.of(owner));
        when(boardGenerator.generateEmptyBoard(savedProject)).thenReturn(emptyBoard);

        ProjectDTO result = projectService.createProject(request, owner);

        assertNotNull(result);
        assertEquals(projectId, result.getId());
        assertEquals(boardId, result.getBoardId());

        verify(boardGenerator).generateEmptyBoard(savedProject);
        verify(aiEngine, never()).analyzeProjectDescription(any(), any());
        verify(boardGenerator, never()).generateBoard(any(Project.class), any(AIAnalysisResult.class));
    }
}
