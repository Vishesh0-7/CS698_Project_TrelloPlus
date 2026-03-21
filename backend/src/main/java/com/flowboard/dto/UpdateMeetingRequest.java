package com.flowboard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateMeetingRequest {
    @NotBlank(message = "Meeting title is required")
    @Size(min = 3, max = 255, message = "Title must be between 3 and 255 characters")
    private String title;

    @Size(max = 1000, message = "Description must be 1000 characters or fewer")
    private String description;

    @NotNull(message = "Meeting date is required")
    private LocalDate meetingDate;

    private LocalTime meetingTime;

    @Size(max = 50, message = "Platform must be 50 characters or fewer")
    private String platform;

    @Size(max = 500, message = "Meeting link must be 500 characters or fewer")
    @Pattern(regexp = "^(https?://)?.*", message = "Meeting link should be a valid URL")
    private String meetingLink;
}