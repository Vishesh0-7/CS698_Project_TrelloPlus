package com.flowboard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MeetingDTO {
    private UUID id;
    private UUID projectId;
    private String projectName;
    private String title;
    private String description;
    private LocalDate meetingDate;
    private LocalTime meetingTime;
    private String platform;
    private String meetingLink;
    private String status;
    private String createdByName;
    private LocalDateTime createdAt;
    private List<UserDTO> members;
}
