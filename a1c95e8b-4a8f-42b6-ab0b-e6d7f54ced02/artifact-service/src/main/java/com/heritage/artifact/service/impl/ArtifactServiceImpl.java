package com.heritage.artifact.service.impl;

import cn.hutool.core.util.IdUtil;
import com.heritage.artifact.dto.ArtifactSearchDTO;
import com.heritage.artifact.entity.Artifact;
import com.heritage.artifact.entity.ArtifactDocument;
import com.heritage.artifact.entity.ArtifactImage;
import com.heritage.artifact.entity.ArtifactModel3D;
import com.heritage.artifact.enums.ArtifactLevel;
import com.heritage.artifact.enums.ArtifactStatus;
import com.heritage.artifact.enums.ArtifactType;
import com.heritage.artifact.repository.ArtifactRepository;
import com.heritage.artifact.service.ArtifactService;
import com.heritage.artifact.service.MinioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ArtifactServiceImpl implements ArtifactService {

    private final ArtifactRepository artifactRepository;
    private final MinioService minioService;
    private final MongoTemplate mongoTemplate;

    @Override
    public Artifact createArtifact(Artifact artifact) {
        if (artifact.getArtifactCode() == null || artifact.getArtifactCode().isEmpty()) {
            artifact.setArtifactCode(generateArtifactCode());
        }
        if (artifactRepository.existsByArtifactCode(artifact.getArtifactCode())) {
            throw new RuntimeException("文物标识码已存在: " + artifact.getArtifactCode());
        }
        artifact.setCreateTime(LocalDateTime.now());
        artifact.setUpdateTime(LocalDateTime.now());
        return artifactRepository.save(artifact);
    }

    @Override
    public Artifact updateArtifact(String id, Artifact artifact) {
        Artifact existing = getArtifactById(id);
        if (artifact.getName() != null) existing.setName(artifact.getName());
        if (artifact.getSubtitle() != null) existing.setSubtitle(artifact.getSubtitle());
        if (artifact.getType() != null) existing.setType(artifact.getType());
        if (artifact.getLevel() != null) existing.setLevel(artifact.getLevel());
        if (artifact.getStatus() != null) existing.setStatus(artifact.getStatus());
        if (artifact.getDynasty() != null) existing.setDynasty(artifact.getDynasty());
        if (artifact.getEra() != null) existing.setEra(artifact.getEra());
        if (artifact.getOrigin() != null) existing.setOrigin(artifact.getOrigin());
        if (artifact.getDiscoveryLocation() != null) existing.setDiscoveryLocation(artifact.getDiscoveryLocation());
        if (artifact.getCurrentLocation() != null) existing.setCurrentLocation(artifact.getCurrentLocation());
        if (artifact.getDimensions() != null) existing.setDimensions(artifact.getDimensions());
        if (artifact.getWeight() != null) existing.setWeight(artifact.getWeight());
        if (artifact.getMaterial() != null) existing.setMaterial(artifact.getMaterial());
        if (artifact.getTechnique() != null) existing.setTechnique(artifact.getTechnique());
        if (artifact.getInscription() != null) existing.setInscription(artifact.getInscription());
        if (artifact.getDescription() != null) existing.setDescription(artifact.getDescription());
        if (artifact.getHistoricalNote() != null) existing.setHistoricalNote(artifact.getHistoricalNote());
        if (artifact.getBibliography() != null) existing.setBibliography(artifact.getBibliography());
        if (artifact.getCustodian() != null) existing.setCustodian(artifact.getCustodian());
        if (artifact.getDataAccessLevel() != null) existing.setDataAccessLevel(artifact.getDataAccessLevel());
        existing.setUpdateTime(LocalDateTime.now());
        return artifactRepository.save(existing);
    }

    @Override
    public void deleteArtifact(String id) {
        Artifact artifact = getArtifactById(id);
        artifact.getImages().forEach(img -> {
            try {
                minioService.deleteFile(img.getFileName());
            } catch (Exception ignored) {}
        });
        artifact.getModels3d().forEach(m -> {
            try {
                minioService.deleteFile(m.getFileName());
            } catch (Exception ignored) {}
        });
        artifact.getDocuments().forEach(d -> {
            try {
                minioService.deleteFile(d.getFileName());
            } catch (Exception ignored) {}
        });
        artifactRepository.deleteById(id);
    }

    @Override
    public Artifact getArtifactById(String id) {
        return artifactRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("文物不存在: " + id));
    }

    @Override
    public Artifact getArtifactByCode(String artifactCode) {
        return artifactRepository.findByArtifactCode(artifactCode)
            .orElseThrow(() -> new RuntimeException("文物不存在: " + artifactCode));
    }

    @Override
    public Page<Artifact> searchArtifacts(ArtifactSearchDTO searchDTO) {
        Query query = new Query();

        if (searchDTO.getKeyword() != null && !searchDTO.getKeyword().isEmpty()) {
            String regex = ".*" + searchDTO.getKeyword() + ".*";
            query.addCriteria(new Criteria().orOperator(
                Criteria.where("name").regex(regex, "i"),
                Criteria.where("artifactCode").regex(regex, "i"),
                Criteria.where("description").regex(regex, "i"),
                Criteria.where("dynasty").regex(regex, "i"),
                Criteria.where("material").regex(regex, "i")
            ));
        }
        if (searchDTO.getType() != null) query.addCriteria(Criteria.where("type").is(searchDTO.getType()));
        if (searchDTO.getLevel() != null) query.addCriteria(Criteria.where("level").is(searchDTO.getLevel()));
        if (searchDTO.getStatus() != null) query.addCriteria(Criteria.where("status").is(searchDTO.getStatus()));
        if (searchDTO.getDynasty() != null && !searchDTO.getDynasty().isEmpty())
            query.addCriteria(Criteria.where("dynasty").regex(searchDTO.getDynasty(), "i"));
        if (searchDTO.getEra() != null && !searchDTO.getEra().isEmpty())
            query.addCriteria(Criteria.where("era").regex(searchDTO.getEra(), "i"));
        if (searchDTO.getOrigin() != null && !searchDTO.getOrigin().isEmpty())
            query.addCriteria(Criteria.where("origin").regex(searchDTO.getOrigin(), "i"));
        if (searchDTO.getDataAccessLevel() != null)
            query.addCriteria(Criteria.where("dataAccessLevel").lte(searchDTO.getDataAccessLevel()));

        Sort sort = searchDTO.getSortDir().equalsIgnoreCase("asc")
            ? Sort.by(searchDTO.getSortBy()).ascending()
            : Sort.by(searchDTO.getSortBy()).descending();
        PageRequest pageRequest = PageRequest.of(searchDTO.getPage(), searchDTO.getSize(), sort);
        query.with(pageRequest);

        List<Artifact> artifacts = mongoTemplate.find(query, Artifact.class);
        long total = mongoTemplate.count(Query.of(query).limit(-1).skip(-1), Artifact.class);

        return PageableExecutionUtils.getPage(artifacts, pageRequest, () -> total);
    }

    @Override
    public List<Artifact> getArtifactsByType(String type) {
        return artifactRepository.findByType(ArtifactType.valueOf(type));
    }

    @Override
    public List<Artifact> getArtifactsByLevel(String level) {
        return artifactRepository.findByLevel(ArtifactLevel.valueOf(level));
    }

    @Override
    public List<Artifact> getArtifactsByStatus(String status) {
        return artifactRepository.findByStatus(ArtifactStatus.valueOf(status));
    }

    @Override
    public ArtifactImage uploadImage(String artifactId, MultipartFile file, String description, boolean isCover) {
        Artifact artifact = getArtifactById(artifactId);
        String fileName = "images/" + artifactId + "/" + UUID.randomUUID().toString() + getExtension(file.getOriginalFilename());
        String fileUrl = minioService.uploadFile(file, fileName);

        ArtifactImage image = ArtifactImage.builder()
            .id(IdUtil.fastSimpleUUID())
            .fileName(fileName)
            .originalName(file.getOriginalFilename())
            .fileUrl(fileUrl)
            .mimeType(file.getContentType())
            .fileSize(file.getSize())
            .description(description)
            .isCover(isCover)
            .sortOrder(artifact.getImages().size())
            .uploadTime(LocalDateTime.now())
            .build();

        if (isCover) {
            artifact.getImages().forEach(img -> img.setIsCover(false));
        }
        artifact.getImages().add(image);
        artifactRepository.save(artifact);
        return image;
    }

    @Override
    public void deleteImage(String artifactId, String imageId) {
        Artifact artifact = getArtifactById(artifactId);
        artifact.getImages().removeIf(img -> {
            if (img.getId().equals(imageId)) {
                try {
                    minioService.deleteFile(img.getFileName());
                } catch (Exception ignored) {}
                return true;
            }
            return false;
        });
        artifactRepository.save(artifact);
    }

    @Override
    public ArtifactModel3D uploadModel3D(String artifactId, MultipartFile file, String format, String description) {
        Artifact artifact = getArtifactById(artifactId);
        String fileName = "models3d/" + artifactId + "/" + UUID.randomUUID().toString() + getExtension(file.getOriginalFilename());
        String fileUrl = minioService.uploadFile(file, fileName);

        ArtifactModel3D model = ArtifactModel3D.builder()
            .id(IdUtil.fastSimpleUUID())
            .fileName(fileName)
            .originalName(file.getOriginalFilename())
            .fileUrl(fileUrl)
            .mimeType(file.getContentType())
            .fileSize(file.getSize())
            .format(format)
            .description(description)
            .uploadTime(LocalDateTime.now())
            .build();

        artifact.getModels3d().add(model);
        artifactRepository.save(artifact);
        return model;
    }

    @Override
    public void deleteModel3D(String artifactId, String modelId) {
        Artifact artifact = getArtifactById(artifactId);
        artifact.getModels3d().removeIf(m -> {
            if (m.getId().equals(modelId)) {
                try {
                    minioService.deleteFile(m.getFileName());
                } catch (Exception ignored) {}
                return true;
            }
            return false;
        });
        artifactRepository.save(artifact);
    }

    @Override
    public ArtifactDocument uploadDocument(String artifactId, MultipartFile file, String category, String description) {
        Artifact artifact = getArtifactById(artifactId);
        String fileName = "documents/" + artifactId + "/" + UUID.randomUUID().toString() + getExtension(file.getOriginalFilename());
        String fileUrl = minioService.uploadFile(file, fileName);

        ArtifactDocument doc = ArtifactDocument.builder()
            .id(IdUtil.fastSimpleUUID())
            .fileName(fileName)
            .originalName(file.getOriginalFilename())
            .fileUrl(fileUrl)
            .mimeType(file.getContentType())
            .fileSize(file.getSize())
            .category(category)
            .description(description)
            .uploadTime(LocalDateTime.now())
            .build();

        artifact.getDocuments().add(doc);
        artifactRepository.save(artifact);
        return doc;
    }

    @Override
    public void deleteDocument(String artifactId, String documentId) {
        Artifact artifact = getArtifactById(artifactId);
        artifact.getDocuments().removeIf(d -> {
            if (d.getId().equals(documentId)) {
                try {
                    minioService.deleteFile(d.getFileName());
                } catch (Exception ignored) {}
                return true;
            }
            return false;
        });
        artifactRepository.save(artifact);
    }

    @Override
    public Artifact updateStatus(String id, String status) {
        Artifact artifact = getArtifactById(id);
        artifact.setStatus(ArtifactStatus.valueOf(status));
        artifact.setUpdateTime(LocalDateTime.now());
        return artifactRepository.save(artifact);
    }

    @Override
    public String generateArtifactCode() {
        String prefix = "WH";
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String seq = String.format("%06d", (int) (Math.random() * 1000000));
        return prefix + date + seq;
    }

    @Override
    public long countArtifacts() {
        return artifactRepository.count();
    }

    private String getExtension(String filename) {
        if (filename == null) return "";
        int idx = filename.lastIndexOf('.');
        return idx > 0 ? filename.substring(idx) : "";
    }
}
