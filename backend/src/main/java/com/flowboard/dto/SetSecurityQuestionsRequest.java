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
public class SetSecurityQuestionsRequest {
    private String currentPassword;

    @NotBlank(message = "Security question 1 is required")
    private String securityQuestion1;

    @NotBlank(message = "Security answer 1 is required")
    @Size(max = 500, message = "Answer 1 cannot exceed 500 characters")
    private String securityAnswer1;

    @NotBlank(message = "Security question 2 is required")
    private String securityQuestion2;

    @NotBlank(message = "Security answer 2 is required")
    @Size(max = 500, message = "Answer 2 cannot exceed 500 characters")
    private String securityAnswer2;

    @NotBlank(message = "Custom security question is required")
    @Size(min = 1, max = 255, message = "Custom question must be between 1 and 255 characters")
    private String customSecurityQuestion;

    @NotBlank(message = "Custom security answer is required")
    @Size(max = 500, message = "Custom answer cannot exceed 500 characters")
    private String customSecurityAnswer;
}
