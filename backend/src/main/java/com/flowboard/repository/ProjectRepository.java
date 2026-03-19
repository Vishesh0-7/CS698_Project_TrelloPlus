package com.flowboard.repository;

import com.flowboard.entity.Project;
import com.flowboard.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProjectRepository extends JpaRepository<Project, UUID> {
    List<Project> findByOwner(User owner);
    List<Project> findByMembersContains(User user);

    @Query("SELECT p FROM Project p WHERE p.owner = :owner AND (p.isDeletionMarked = false OR p.isDeletionMarked IS NULL)")
    List<Project> findActiveProjectsByOwner(@Param("owner") User owner);

    @Query(value = "SELECT DISTINCT p.* FROM projects p " +
        "LEFT JOIN project_members pm ON pm.project_id = p.id " +
        "WHERE (p.owner_id = :userId OR pm.user_id = :userId) " +
        "AND (p.is_deletion_marked = false OR p.is_deletion_marked IS NULL)", nativeQuery = true)
    List<Project> findActiveProjectsForUserId(@Param("userId") UUID userId);

    @Query("SELECT p FROM Project p WHERE p.owner = :owner AND LOWER(p.name) = LOWER(:name) " +
        "AND (p.isDeletionMarked = false OR p.isDeletionMarked IS NULL)")
    List<Project> findActiveByOwnerAndNameIgnoreCase(@Param("owner") User owner, @Param("name") String name);
}
