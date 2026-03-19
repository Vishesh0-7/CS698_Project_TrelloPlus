package com.flowboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardRequest {
    @NotBlank(message = "Card title is required")
    @Size(max = 255, message = "Card title must be 255 characters or fewer")
    private String title;

    @Size(max = 5000, message = "Card description must be 5000 characters or fewer")
    private String description;

    @NotBlank(message = "Priority is required")
    @Pattern(regexp = "^(?i)(LOW|MEDIUM|HIGH|CRITICAL)$", message = "Priority must be LOW, MEDIUM, HIGH, or CRITICAL")
    private String priority;

    @JsonProperty("assignee_id")
    private UUID assigneeId;
}
