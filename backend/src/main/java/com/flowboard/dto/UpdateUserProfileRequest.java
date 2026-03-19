package com.flowboard.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateUserProfileRequest {
    @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters")
    private String fullName;

    @Email(message = "Email format is invalid")
    @Size(max = 254, message = "Email must be 254 characters or fewer")
    private String email;

    @AssertTrue(message = "At least one field must be provided for update")
    public boolean isAnyFieldProvided() {
        return (fullName != null && !fullName.trim().isEmpty())
            || (email != null && !email.trim().isEmpty());
    }
}
