package com.flowboard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpsertDecisionRequest {
    @NotBlank(message = "Description is required")
    @Size(max = 2000, message = "Description must be 2000 characters or fewer")
    private String description;

    @Size(max = 4000, message = "Source context must be 4000 characters or fewer")
    private String sourceContext;

    @Size(max = 4000, message = "Impact summary must be 4000 characters or fewer")
    private String impactSummary;
}
