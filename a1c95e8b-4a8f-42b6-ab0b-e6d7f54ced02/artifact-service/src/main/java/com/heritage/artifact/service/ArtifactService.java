package com.heritage.artifact.service;

import com.heritage.artifact.dto.ArtifactSearchDTO;
import com.heritage.artifact.entity.Artifact;
import com.heritage.artifact.entity.ArtifactDocument;
import com.heritage.artifact.entity.ArtifactImage;
import com.heritage.artifact.entity.ArtifactModel3D;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface ArtifactService {

    Artifact createArtifact(Artifact artifact);

    Artifact updateArtifact(String id, Artifact artifact);

    void deleteArtifact(String id);

    Artifact getArtifactById(String id);

    Artifact getArtifactByCode(String artifactCode);

    Page<Artifact> searchArtifacts(ArtifactSearchDTO searchDTO);

    List<Artifact> getArtifactsByType(String type);

    List<Artifact> getArtifactsByLevel(String level);

    List<Artifact> getArtifactsByStatus(String status);

    ArtifactImage uploadImage(String artifactId, MultipartFile file, String description, boolean isCover);

    void deleteImage(String artifactId, String imageId);

    ArtifactModel3D uploadModel3D(String artifactId, MultipartFile file, String format, String description);

    void deleteModel3D(String artifactId, String modelId);

    ArtifactDocument uploadDocument(String artifactId, MultipartFile file, String category, String description);

    void deleteDocument(String artifactId, String documentId);

    Artifact updateStatus(String id, String status);

    String generateArtifactCode();

    long countArtifacts();
}
