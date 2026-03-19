package com.flowboard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateProjectRequest {
    @NotBlank(message = "Project name is required")
    @Size(max = 255, message = "Project name must be 255 characters or fewer")
    private String name;

    @Size(max = 5000, message = "Project description must be 5000 characters or fewer")
    private String description;

    private Boolean generateTasks;
}
