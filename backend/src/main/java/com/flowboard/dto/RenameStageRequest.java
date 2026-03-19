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
public class RenameStageRequest {
    @NotBlank(message = "Stage title is required")
    @Size(max = 100, message = "Stage title must be 100 characters or fewer")
    private String title;
}
