package com.flowboard.service;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowboard.dto.AIAnalysisResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class AIEngine {
    private static final int MIN_STAGE_COUNT = 4;
    private static final int MAX_STAGE_COUNT = 8;
    private static final String[] DEFAULT_STAGE_TITLES = {
        "Backlog", "To Do", "In Progress", "Review", "Testing", "Ready", "Blocked", "Done"
    };
    private static final String[] DEFAULT_STAGE_COLORS = {
        "bg-slate-100", "bg-gray-100", "bg-blue-100", "bg-amber-100", "bg-violet-100", "bg-cyan-100", "bg-rose-100", "bg-green-100"
    };
    private static final Set<String> VALID_PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL");

    @Value("${ai.bedrock.region:us-east-2}")
    private String bedrockRegion;

    @Value("${ai.bedrock.model-id:amazon.nova-micro-v1:0}")
    private String bedrockModelId;

    @Value("${ai.bedrock.timeout-seconds:30}")
    private long bedrockTimeoutSeconds;

    @Value("${ai.bedrock.max-tokens:2048}")
    private int bedrockMaxTokens;

    private final ObjectMapper objectMapper;

    /**
     * Analyzes project description and generates AI-suggested board structure.
     */
    public AIAnalysisResult analyzeProjectDescription(String projectName, String description) {
        try {
            ProjectAnalysisPayload payload = callBedrock(
                buildProjectPrompt(projectName, description),
                ProjectAnalysisPayload.class
            );
            return normalizeProjectAnalysis(projectName, description, payload);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "LLM project analysis failed: " + ex.getMessage(), ex);
        }
    }

    private AIAnalysisResult.StageInfo createStage(String title, String color, int position) {
        AIAnalysisResult.StageInfo stage = new AIAnalysisResult.StageInfo();
        stage.title = title;
        stage.color = color;
        stage.position = position;
        return stage;
    }

    private AIAnalysisResult.TaskInfo createTask(String title, String description, String priority, String stageTitle) {
        AIAnalysisResult.TaskInfo task = new AIAnalysisResult.TaskInfo();
        task.title = title;
        task.description = description;
        task.priority = priority;
        task.stageTitle = stageTitle;
        return task;
    }

    /**
     * Analyzes meeting transcript to extract action items, decisions, and suggested changes.
     */
    public MeetingAnalysisResult analyzeMeetingTranscript(String transcript) {
        try {
            MeetingAnalysisPayload payload = callBedrock(
                buildMeetingPrompt(transcript),
                MeetingAnalysisPayload.class
            );
            return normalizeMeetingAnalysis(transcript, payload);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "LLM meeting analysis failed: " + ex.getMessage(), ex);
        }
    }

    private AIAnalysisResult normalizeProjectAnalysis(String projectName, String description, ProjectAnalysisPayload payload) {
        AIAnalysisResult result = new AIAnalysisResult();

        List<ProjectStageSuggestion> stageSuggestions = payload == null || payload.stages == null ? List.of() : payload.stages;
        if (stageSuggestions.isEmpty()) {
            stageSuggestions = fetchStagesWithRetry(projectName, description);
        }
        List<AIAnalysisResult.StageInfo> stages = normalizeStages(stageSuggestions);

        result.setStages(stages);
        List<ProjectTaskSuggestion> taskSuggestions = payload == null || payload.tasks == null ? List.of() : payload.tasks;
        if (taskSuggestions.isEmpty()) {
            taskSuggestions = fetchTasksWithRetry(projectName, description, stages);
        }
        result.setTasks(normalizeProjectTasks(projectName, description, stages, taskSuggestions));
        return result;
    }

    private List<AIAnalysisResult.StageInfo> normalizeStages(List<ProjectStageSuggestion> stageSuggestions) {
        List<AIAnalysisResult.StageInfo> stages = new ArrayList<>();
        java.util.Set<String> seenTitles = new java.util.HashSet<>();

        if (stageSuggestions != null) {
            for (ProjectStageSuggestion suggestion : stageSuggestions) {
                if (stages.size() >= MAX_STAGE_COUNT) {
                    break;
                }
                String title = defaultIfBlank(suggestion.title, "").trim();
                if (title.isBlank()) {
                    continue;
                }
                String key = title.toLowerCase(Locale.ROOT);
                if (seenTitles.contains(key)) {
                    continue;
                }
                seenTitles.add(key);
                int position = stages.size();
                stages.add(createStage(title, DEFAULT_STAGE_COLORS[Math.min(position, DEFAULT_STAGE_COLORS.length - 1)], position));
            }
        }

        int defaultIndex = 0;
        while (stages.size() < MIN_STAGE_COUNT && defaultIndex < DEFAULT_STAGE_TITLES.length) {
            String title = DEFAULT_STAGE_TITLES[defaultIndex++];
            String key = title.toLowerCase(Locale.ROOT);
            if (seenTitles.contains(key)) {
                continue;
            }
            seenTitles.add(key);
            int position = stages.size();
            stages.add(createStage(title, DEFAULT_STAGE_COLORS[Math.min(position, DEFAULT_STAGE_COLORS.length - 1)], position));
        }

        if (stages.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "LLM project analysis returned no stages");
        }

        return stages;
    }

    private List<ProjectStageSuggestion> fetchStagesWithRetry(String projectName, String description) {
        try {
            ProjectAnalysisPayload retryPayload = callBedrock(
                buildProjectStagesPrompt(projectName, description),
                ProjectAnalysisPayload.class
            );
            return retryPayload == null || retryPayload.stages == null ? List.of() : retryPayload.stages;
        } catch (Exception ex) {
            log.warn("LLM stage retry failed: {}", ex.getMessage());
            return List.of();
        }
    }

    private List<ProjectTaskSuggestion> fetchTasksWithRetry(
        String projectName,
        String description,
        List<AIAnalysisResult.StageInfo> stages
    ) {
        try {
            ProjectAnalysisPayload retryPayload = callBedrock(
                buildProjectTasksPrompt(projectName, description, stages),
                ProjectAnalysisPayload.class
            );
            return retryPayload == null || retryPayload.tasks == null ? List.of() : retryPayload.tasks;
        } catch (Exception ex) {
            log.warn("LLM task retry failed: {}", ex.getMessage());
            return List.of();
        }
    }

    private List<AIAnalysisResult.TaskInfo> normalizeProjectTasks(
        String projectName,
        String description,
        List<AIAnalysisResult.StageInfo> stages,
        List<ProjectTaskSuggestion> taskSuggestions
    ) {
        if (taskSuggestions == null || taskSuggestions.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "LLM project analysis returned no tasks");
        }

        List<AIAnalysisResult.TaskInfo> tasks = new ArrayList<>();
        String fallbackStage = stages.isEmpty() ? DEFAULT_STAGE_TITLES[0] : stages.get(0).title;
        for (ProjectTaskSuggestion suggestion : taskSuggestions) {
            String stageTitle = normalizeStageTitle(suggestion.stageTitle, stages, fallbackStage);
            tasks.add(createTask(
                defaultIfBlank(suggestion.title, "Generated task"),
                defaultIfBlank(suggestion.description, "Generated task for " + projectName),
                normalizePriority(suggestion.priority, "MEDIUM"),
                stageTitle
            ));
        }

        return tasks;
    }

    private MeetingAnalysisResult normalizeMeetingAnalysis(String transcript, MeetingAnalysisPayload payload) {
        if (payload == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "LLM meeting analysis returned no data");
        }

        MeetingAnalysisResult result = new MeetingAnalysisResult();

        if (payload.actionItems != null) {
            for (MeetingActionItemSuggestion item : payload.actionItems) {
                result.addActionItem(
                    defaultIfBlank(item.description, "Generated action item"),
                    defaultIfBlank(item.sourceContext, "From meeting transcript"),
                    normalizePriority(item.priority, "MEDIUM")
                );
            }
        }

        if (payload.decisions != null) {
            for (MeetingDecisionSuggestion decision : payload.decisions) {
                result.addDecision(
                    defaultIfBlank(decision.description, "Generated decision"),
                    defaultIfBlank(decision.sourceContext, "From meeting transcript")
                );
            }
        }

        if (payload.changes != null) {
            for (MeetingChangeSuggestion change : payload.changes) {
                result.addChange(
                    normalizeChangeType(change.type),
                    defaultIfBlank(change.description, "Generated change"),
                    defaultIfBlank(change.context, "From meeting transcript")
                );
            }
        }

        if (result.getActionItems().isEmpty() && result.getDecisions().isEmpty() && result.getChanges().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "LLM meeting analysis returned empty data");
        }

        return result;
    }

    private <T> T callBedrock(String prompt, Class<T> responseType) throws IOException {
        String generatedJson = stripCodeFences(invokeBedrock(prompt));
        if (generatedJson == null || generatedJson.isBlank()) {
            throw new IOException("Bedrock response body was empty");
        }

        return objectMapper.readValue(generatedJson, responseType);
    }

    private String invokeBedrock(String prompt) throws IOException {
        try (BedrockRuntimeClient bedrockClient = BedrockRuntimeClient.builder()
            .region(Region.of(bedrockRegion))
            .overrideConfiguration(ClientOverrideConfiguration.builder()
                .apiCallTimeout(Duration.ofSeconds(bedrockTimeoutSeconds))
                .build())
            .build()) {
            String requestJson = buildBedrockRequestPayload(prompt);

            InvokeModelRequest request = InvokeModelRequest.builder()
                .modelId(bedrockModelId)
                .contentType("application/json")
                .accept("application/json")
                .body(SdkBytes.fromUtf8String(requestJson))
                .build();

            InvokeModelResponse response = bedrockClient.invokeModel(request);
            return extractBedrockTextResponse(response == null ? null : response.body());
        } catch (Exception ex) {
            throw new IOException("Bedrock call failed: " + ex.getMessage(), ex);
        }
    }

    private String buildBedrockRequestPayload(String prompt) throws IOException {
        if (isAnthropicModel()) {
            return objectMapper.writeValueAsString(new AnthropicMessagesRequest(prompt, bedrockMaxTokens));
        }

        if (isNovaModel()) {
            return objectMapper.writeValueAsString(new NovaMessagesRequest(prompt, bedrockMaxTokens));
        }

        if (isTitanTextModel()) {
            return objectMapper.writeValueAsString(new TitanTextRequest(prompt, bedrockMaxTokens));
        }

        throw new IOException("Unsupported BEDROCK_MODEL_ID format: " + bedrockModelId
            + ". Supported prefixes: anthropic., amazon.nova, amazon.titan-text");
    }

    private String extractBedrockTextResponse(SdkBytes responseBody) throws IOException {
        if (responseBody == null) {
            throw new IOException("Bedrock returned an empty response body");
        }

        String rawJson = responseBody.asUtf8String();
        if (rawJson == null || rawJson.isBlank()) {
            throw new IOException("Bedrock returned an empty response payload");
        }

        if (isAnthropicModel()) {
            AnthropicMessagesResponse response = objectMapper.readValue(rawJson, AnthropicMessagesResponse.class);
            if (response.content != null) {
                for (AnthropicContentBlock block : response.content) {
                    if (block != null && block.text != null && !block.text.isBlank()) {
                        return block.text;
                    }
                }
            }
            throw new IOException("Bedrock anthropic response did not include text content");
        }

        if (isNovaModel()) {
            NovaMessagesResponse response = objectMapper.readValue(rawJson, NovaMessagesResponse.class);
            if (response.output != null && response.output.message != null && response.output.message.content != null) {
                for (NovaContentPart part : response.output.message.content) {
                    if (part != null && part.text != null && !part.text.isBlank()) {
                        return part.text;
                    }
                }
            }
            throw new IOException("Bedrock Nova response did not include text content");
        }

        if (isTitanTextModel()) {
            TitanTextResponse response = objectMapper.readValue(rawJson, TitanTextResponse.class);
            if (response.results != null) {
                for (TitanTextResult result : response.results) {
                    if (result != null && result.outputText != null && !result.outputText.isBlank()) {
                        return result.outputText;
                    }
                }
            }
            throw new IOException("Bedrock Titan response did not include output text");
        }

        throw new IOException("Unsupported BEDROCK_MODEL_ID format for response parsing: " + bedrockModelId);
    }

    private boolean isAnthropicModel() {
        String value = bedrockModelId == null ? "" : bedrockModelId.toLowerCase(Locale.ROOT);
        return value.startsWith("anthropic.") || value.contains("anthropic.claude");
    }

    private boolean isNovaModel() {
        String value = bedrockModelId == null ? "" : bedrockModelId.toLowerCase(Locale.ROOT);
        return value.startsWith("amazon.nova") || value.contains("amazon.nova");
    }

    private boolean isTitanTextModel() {
        String value = bedrockModelId == null ? "" : bedrockModelId.toLowerCase(Locale.ROOT);
        return value.startsWith("amazon.titan-text") || value.contains("amazon.titan-text");
    }

    private String buildProjectPrompt(String projectName, String description) {
        return "You are generating a practical kanban plan for a software project. "
            + "Return only valid JSON with this exact schema: "
            + "{\"stages\":[{\"title\":\"string\"}],\"tasks\":[{\"title\":\"string\",\"description\":\"string\",\"priority\":\"LOW|MEDIUM|HIGH|CRITICAL\",\"stageTitle\":\"string\"}]}. "
            + "Generate 4 to 8 stages depending on complexity and 6 to 20 tasks. "
            + "Stage titles must be short, unique, and workflow-oriented. "
            + "Tasks must be concrete and mapped to an existing stageTitle. "
            + "Distribute tasks across multiple stages, not only one stage. "
            + "Project name: " + safeText(projectName) + ". "
            + "Project description: " + safeText(description) + ".";
    }

    private String buildProjectStagesPrompt(String projectName, String description) {
        return "Return only valid JSON with this exact schema: "
            + "{\"stages\":[{\"title\":\"string\"}]}. "
            + "Create 4 to 8 unique workflow stages for a software project. "
            + "Use concise, practical stage names. "
            + "Project name: " + safeText(projectName) + ". "
            + "Project description: " + safeText(description) + ".";
    }

    private String buildProjectTasksPrompt(String projectName, String description, List<AIAnalysisResult.StageInfo> stages) {
        String stageList = stages.stream().map(s -> s.title).reduce((a, b) -> a + ", " + b).orElse("To Do, In Progress, Review, Done");
        return "Return only valid JSON with this exact schema: "
            + "{\"tasks\":[{\"title\":\"string\",\"description\":\"string\",\"priority\":\"LOW|MEDIUM|HIGH|CRITICAL\",\"stageTitle\":\"string\"}]}. "
            + "Create 6 to 20 realistic tasks and use only these stageTitle values: " + stageList + ". "
            + "Spread tasks across multiple stages and prioritize major tasks as HIGH or CRITICAL when appropriate. "
            + "Project name: " + safeText(projectName) + ". "
            + "Project description: " + safeText(description) + ".";
    }

    private String buildMeetingPrompt(String transcript) {
        return "You are analyzing a meeting transcript. "
            + "Return only valid JSON with this exact schema: "
            + "{\"actionItems\":[{\"description\":\"string\",\"sourceContext\":\"string\",\"priority\":\"LOW|MEDIUM|HIGH|CRITICAL\"}],"
            + "\"decisions\":[{\"description\":\"string\",\"sourceContext\":\"string\"}],"
            + "\"changes\":[{\"type\":\"CREATE_CARD|UPDATE_CARD|DELETE_CARD|MOVE_CARD|CREATE_STAGE|UPDATE_STAGE|DELETE_STAGE\",\"description\":\"string\",\"context\":\"string\"}]}. "
            + "Keep the output concise and grounded in the transcript. Transcript: " + safeText(transcript) + ".";
    }

    private String stripCodeFences(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            int lastFence = trimmed.lastIndexOf("```");
            if (firstNewline >= 0 && lastFence > firstNewline) {
                trimmed = trimmed.substring(firstNewline + 1, lastFence).trim();
            }
        }
        return trimmed;
    }

    private String defaultIfBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String normalizePriority(String priority, String fallback) {
        String normalized = priority == null ? "" : priority.trim().toUpperCase(Locale.ROOT);
        return VALID_PRIORITIES.contains(normalized) ? normalized : fallback;
    }

    private String normalizeChangeType(String type) {
        return type == null || type.isBlank() ? "UPDATE_CARD" : type.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeStageTitle(String stageTitle, List<AIAnalysisResult.StageInfo> stages, String fallback) {
        if (stageTitle == null || stageTitle.isBlank()) {
            return fallback;
        }

        String trimmed = stageTitle.trim();
        for (AIAnalysisResult.StageInfo stage : stages) {
            if (stage.title.equalsIgnoreCase(trimmed)) {
                return stage.title;
            }
        }

        return fallback;
    }

    private String safeText(String value) {
        return value == null ? "" : value.replace('"', '\'').trim();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class ProjectAnalysisPayload {
        @JsonAlias({"kanbanStages", "columns"})
        public List<ProjectStageSuggestion> stages;
        @JsonAlias({"kanbanTasks", "cards", "workItems", "items"})
        public List<ProjectTaskSuggestion> tasks;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class ProjectStageSuggestion {
        @JsonAlias({"stageName"})
        public String title;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class ProjectTaskSuggestion {
        public String title;
        public String description;
        public String priority;
        @JsonAlias({"stageName"})
        public String stageTitle;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class MeetingAnalysisPayload {
        public List<MeetingActionItemSuggestion> actionItems;
        public List<MeetingDecisionSuggestion> decisions;
        public List<MeetingChangeSuggestion> changes;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class MeetingActionItemSuggestion {
        public String description;
        @JsonAlias({"context", "source_context"})
        public String sourceContext;
        public String priority;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class MeetingDecisionSuggestion {
        public String description;
        @JsonAlias({"context", "source_context"})
        public String sourceContext;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class MeetingChangeSuggestion {
        public String type;
        public String description;
        @JsonAlias({"sourceContext", "source_context"})
        public String context;
    }

    private static class AnthropicMessagesRequest {
        public String anthropic_version = "bedrock-2023-05-31";
        public int max_tokens;
        public float temperature = 0.1f;
        public List<AnthropicMessage> messages;

        private AnthropicMessagesRequest(String prompt, int maxTokens) {
            this.max_tokens = maxTokens;
            this.messages = List.of(new AnthropicMessage(prompt));
        }
    }

    private static class AnthropicMessage {
        public String role = "user";
        public String content;

        private AnthropicMessage(String content) {
            this.content = content;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class AnthropicMessagesResponse {
        public List<AnthropicContentBlock> content;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class AnthropicContentBlock {
        public String type;
        public String text;
    }

    private static class NovaMessagesRequest {
        public String schemaVersion = "messages-v1";
        public List<NovaMessage> messages;
        public NovaInferenceConfig inferenceConfig;

        private NovaMessagesRequest(String prompt, int maxTokens) {
            this.messages = List.of(new NovaMessage(prompt));
            this.inferenceConfig = new NovaInferenceConfig(maxTokens);
        }
    }

    private static class NovaMessage {
        public String role = "user";
        public List<NovaContentPart> content;

        private NovaMessage(String prompt) {
            this.content = List.of(new NovaContentPart(prompt));
        }
    }

    private static class NovaContentPart {
        public String text;

        public NovaContentPart() {
        }

        public NovaContentPart(String text) {
            this.text = text;
        }
    }

    private static class NovaInferenceConfig {
        public int max_new_tokens;
        public float temperature = 0.1f;

        private NovaInferenceConfig(int maxTokens) {
            this.max_new_tokens = maxTokens;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class NovaMessagesResponse {
        public NovaOutput output;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class NovaOutput {
        public NovaMessageOutput message;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class NovaMessageOutput {
        public List<NovaContentPart> content;
    }

    private static class TitanTextRequest {
        public String inputText;
        public TitanTextGenerationConfig textGenerationConfig;

        private TitanTextRequest(String prompt, int maxTokens) {
            this.inputText = prompt;
            this.textGenerationConfig = new TitanTextGenerationConfig(maxTokens);
        }
    }

    private static class TitanTextGenerationConfig {
        public int maxTokenCount;
        public float temperature = 0.1f;

        private TitanTextGenerationConfig(int maxTokens) {
            this.maxTokenCount = maxTokens;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class TitanTextResponse {
        public List<TitanTextResult> results;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class TitanTextResult {
        public String outputText;
    }

    // Inner class for meeting analysis results
    public static class MeetingAnalysisResult {
        private final List<ActionItemData> actionItems = new java.util.ArrayList<>();
        private final List<DecisionData> decisions = new java.util.ArrayList<>();
        private final List<ChangeData> changes = new java.util.ArrayList<>();

        public void addActionItem(String description, String context, String priority) {
            actionItems.add(new ActionItemData(description, context, priority));
        }

        public void addDecision(String description, String context) {
            decisions.add(new DecisionData(description, context));
        }

        public void addChange(String type, String description, String context) {
            changes.add(new ChangeData(type, description, context));
        }

        public List<ActionItemData> getActionItems() {
            return actionItems;
        }

        public List<DecisionData> getDecisions() {
            return decisions;
        }

        public List<ChangeData> getChanges() {
            return changes;
        }

        public static class ActionItemData {
            public String description;
            public String sourceContext;
            public String priority;

            public ActionItemData(String description, String sourceContext, String priority) {
                this.description = description;
                this.sourceContext = sourceContext;
                this.priority = priority;
            }
        }

        public static class DecisionData {
            public String description;
            public String sourceContext;

            public DecisionData(String description, String sourceContext) {
                this.description = description;
                this.sourceContext = sourceContext;
            }
        }

        public static class ChangeData {
            public String type;
            public String description;
            public String context;

            public ChangeData(String type, String description, String context) {
                this.type = type;
                this.description = description;
                this.context = context;
            }
        }
    }
}
