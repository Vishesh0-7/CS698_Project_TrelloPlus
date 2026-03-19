package com.flowboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MoveCardRequest {
    @NotNull(message = "Target stage id is required")
    @JsonProperty("target_stage_id")
    private UUID targetStageId;
}
