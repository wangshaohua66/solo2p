package com.design.collaboration.service;

import com.design.collaboration.entity.DesignVersion;
import com.design.collaboration.entity.User;
import com.design.collaboration.mapper.UserMapper;
import com.design.collaboration.mapper.VersionMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class VersionService {

    @Value("${file.upload-path}")
    private String uploadPath;

    @Autowired
    private VersionMapper versionMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private ProjectService projectService;

    public DesignVersion findById(Long id) {
        return versionMapper.findById(id);
    }

    public List<DesignVersion> findByConditions(Long projectId, Long taskId, Boolean onlyReleased) {
        return versionMapper.findByConditions(projectId, taskId, onlyReleased);
    }

    public DesignVersion upload(Long projectId, Long taskId, MultipartFile file, String description, Long uploaderId) {
        if (file.isEmpty()) {
            throw new RuntimeException("文件不能为空");
        }

        try {
            Path uploadDir = Paths.get(uploadPath + File.separator + "prj" + projectId);
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }

            String originalFileName = file.getOriginalFilename();
            String ext = "";
            if (originalFileName != null && originalFileName.contains(".")) {
                ext = originalFileName.substring(originalFileName.lastIndexOf("."));
            }
            String storedName = UUID.randomUUID().toString() + ext;
            Path filePath = uploadDir.resolve(storedName);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            Integer maxVer = versionMapper.findMaxVersionNumber(projectId, taskId);
            int nextVer = (maxVer == null ? 0 : maxVer) + 1;
            String versionNo = "V" + nextVer + ".0";

            DesignVersion version = new DesignVersion();
            version.setProjectId(projectId);
            version.setTaskId(taskId);
            version.setVersionNo(versionNo);
            version.setFileName(originalFileName);
            version.setFileSize(file.getSize());
            version.setFilePath(filePath.toString());
            version.setUploadedBy(uploaderId);
            version.setDescription(description);
            version.setIsReleased(false);
            version.setCreatedAt(LocalDateTime.now());
            versionMapper.insert(version);

            User uploader = uploaderId != null ? userMapper.findById(uploaderId) : null;
            projectService.addLog(projectId, "VERSION",
                    "上传图纸版本：" + versionNo + " - " + originalFileName,
                    uploaderId, uploader != null ? uploader.getName() : null);

            return versionMapper.findById(version.getId());
        } catch (IOException e) {
            throw new RuntimeException("文件上传失败：" + e.getMessage());
        }
    }

    public DesignVersion release(Long id, Long operatorId) {
        DesignVersion version = versionMapper.findById(id);
        if (version == null) {
            throw new RuntimeException("版本不存在");
        }
        versionMapper.updateReleased(id, true);

        User operator = operatorId != null ? userMapper.findById(operatorId) : null;
        projectService.addLog(version.getProjectId(), "VERSION",
                "发布版本：" + version.getVersionNo(),
                operatorId, operator != null ? operator.getName() : null);

        return versionMapper.findById(id);
    }

    public boolean delete(Long id) {
        return versionMapper.deleteById(id) > 0;
    }

    public java.io.File getFile(Long id) {
        DesignVersion version = versionMapper.findById(id);
        if (version == null) {
            throw new RuntimeException("版本不存在");
        }
        File file = new File(version.getFilePath());
        if (!file.exists()) {
            throw new RuntimeException("文件不存在");
        }
        return file;
    }
}
