package com.flowboard.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SetSecurityQuestionsRequest {
    @NotBlank(message = "Security question 1 is required")
    private String securityQuestion1;

    @NotBlank(message = "Security answer 1 is required")
    private String securityAnswer1;

    @NotBlank(message = "Security question 2 is required")
    private String securityQuestion2;

    @NotBlank(message = "Security answer 2 is required")
    private String securityAnswer2;

    @NotBlank(message = "Custom security question is required")
    private String customSecurityQuestion;

    @NotBlank(message = "Custom security answer is required")
    private String customSecurityAnswer;
}
