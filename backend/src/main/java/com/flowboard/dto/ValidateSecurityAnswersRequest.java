package com.flowboard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ValidateSecurityAnswersRequest {
    @NotBlank(message = "Email is required")
    private String email;

    @NotEmpty(message = "Security answers are required")
    private Map<String, String> answers;
}
