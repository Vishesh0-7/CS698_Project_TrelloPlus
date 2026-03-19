package com.flowboard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AddStageRequest {
    @NotBlank(message = "Stage title is required")
    @Size(max = 100, message = "Stage title must be 100 characters or fewer")
    private String title;

    @Pattern(
        regexp = "^(#[A-Fa-f0-9]{6}|bg-[a-z]+-[0-9]{2,3})$",
        message = "Color must be a hex color or a supported CSS token"
    )
    private String color;
}
