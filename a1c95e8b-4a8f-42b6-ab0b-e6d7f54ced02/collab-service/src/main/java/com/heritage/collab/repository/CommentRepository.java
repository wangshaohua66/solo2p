package com.heritage.collab.repository;

import com.heritage.collab.entity.Comment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends MongoRepository<Comment, String> {
    List<Comment> findByAppraisalIdOrderByCreateTimeDesc(String appraisalId);
    List<Comment> findByArtifactIdOrderByCreateTimeDesc(String artifactId);
    List<Comment> findByExpertId(String expertId);
    List<Comment> findByParentId(String parentId);
    void deleteByAppraisalId(String appraisalId);
}
