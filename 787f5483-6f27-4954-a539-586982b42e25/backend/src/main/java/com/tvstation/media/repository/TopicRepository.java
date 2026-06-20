package com.tvstation.media.repository;

import com.tvstation.media.entity.Topic;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface TopicRepository extends JpaRepository<Topic, Long>, JpaSpecificationExecutor<Topic> {

    Page<Topic> findByStatusAndDeletedFalse(Topic.TopicStatus status, Pageable pageable);

    Page<Topic> findByCreatorIdAndDeletedFalse(Long creatorId, Pageable pageable);

    Page<Topic> findByChannelAndDeletedFalse(Topic.Channel channel, Pageable pageable);

    Page<Topic> findByProgramTypeAndDeletedFalse(Topic.ProgramType programType, Pageable pageable);

    @Query("SELECT t FROM Topic t WHERE t.deleted = false AND " +
           "(:status IS NULL OR t.status = :status) AND " +
           "(:programType IS NULL OR t.programType = :programType) AND " +
           "(:channel IS NULL OR t.channel = :channel) AND " +
           "(:keyword IS NULL OR LOWER(t.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(t.description) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<Topic> findByFilters(
            @Param("status") Topic.TopicStatus status,
            @Param("programType") Topic.ProgramType programType,
            @Param("channel") Topic.Channel channel,
            @Param("keyword") String keyword,
            Pageable pageable);

    List<Topic> findByStatusAndExpectedAirDateBetweenAndDeletedFalse(
            Topic.TopicStatus status,
            LocalDate startDate,
            LocalDate endDate);

    @Query("SELECT t.programType, COUNT(t) FROM Topic t WHERE t.deleted = false GROUP BY t.programType")
    List<Object[]> countByProgramType();

    @Query("SELECT t.channel, COUNT(t) FROM Topic t WHERE t.deleted = false GROUP BY t.channel")
    List<Object[]> countByChannel();

    @Query("SELECT COUNT(t) FROM Topic t WHERE t.deleted = false AND t.createdAt >= :startDate AND t.createdAt <= :endDate")
    Long countByDateRange(@Param("startDate") java.time.LocalDateTime startDate,
                          @Param("endDate") java.time.LocalDateTime endDate);

    @Query("SELECT t.creatorId, t.creatorName, COUNT(t), COALESCE(SUM(t.duration), 0) " +
           "FROM Topic t WHERE t.deleted = false " +
           "AND (:creatorId IS NULL OR t.creatorId = :creatorId) " +
           "AND t.createdAt >= :startDate AND t.createdAt <= :endDate " +
           "GROUP BY t.creatorId, t.creatorName")
    List<Object[]> aggregateByCreator(@Param("startDate") java.time.LocalDateTime startDate,
                                      @Param("endDate") java.time.LocalDateTime endDate,
                                      @Param("creatorId") Long creatorId);
}
