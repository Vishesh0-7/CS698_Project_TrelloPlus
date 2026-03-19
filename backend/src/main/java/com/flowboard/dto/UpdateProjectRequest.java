package com.flowboard.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateProjectRequest {
    @Size(max = 255, message = "Project name must be 255 characters or fewer")
    private String name;

    @Size(max = 5000, message = "Project description must be 5000 characters or fewer")
    private String description;

    @AssertTrue(message = "At least one field must be provided for update")
    public boolean isAnyFieldProvided() {
        return (name != null && !name.trim().isEmpty())
            || description != null;
    }
}
