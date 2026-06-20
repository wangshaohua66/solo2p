package com.tvstation.media.repository;

import com.tvstation.media.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {

    List<Task> findByTopicIdOrderByCreatedAtAsc(Long topicId);

    List<Task> findByAssigneeIdAndDeletedFalse(Long assigneeId);

    List<Task> findByStatusAndDeletedFalse(Task.TaskStatus status);

    @Query("SELECT t FROM Task t WHERE t.deleted = false AND " +
           "t.assigneeId = :assigneeId AND t.status IN :statuses")
    List<Task> findByAssigneeIdAndStatusIn(
            @Param("assigneeId") Long assigneeId,
            @Param("statuses") List<Task.TaskStatus> statuses);

    @Query("SELECT t.status, COUNT(t) FROM Task t WHERE t.deleted = false GROUP BY t.status")
    List<Object[]> countByStatus();

    @Query("SELECT t.type, COUNT(t) FROM Task t WHERE t.deleted = false GROUP BY t.type")
    List<Object[]> countByType();

    boolean existsByTopicIdAndStatus(Long topicId, Task.TaskStatus status);
}
