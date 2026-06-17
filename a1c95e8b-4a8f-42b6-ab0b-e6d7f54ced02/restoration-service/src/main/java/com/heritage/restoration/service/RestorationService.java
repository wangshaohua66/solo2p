package com.heritage.restoration.service;

import com.heritage.restoration.dto.ProgressUpdateDTO;
import com.heritage.restoration.dto.ProjectCreateDTO;
import com.heritage.restoration.dto.ProjectSearchDTO;
import com.heritage.restoration.entity.RestorationMaterial;
import com.heritage.restoration.entity.RestorationPhoto;
import com.heritage.restoration.entity.RestorationProject;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.Map;

public interface RestorationService {

    RestorationProject create(ProjectCreateDTO dto, String operatorId, String operatorName);

    RestorationProject update(String id, ProjectCreateDTO dto);

    void delete(String id);

    RestorationProject getById(String id);

    Page<RestorationProject> search(ProjectSearchDTO dto);

    RestorationProject updateStatus(String id, String targetStatus, String operatorId, String operatorName);

    RestorationProject updateProgress(String id, ProgressUpdateDTO dto, String operatorId, String operatorName);

    List<Map<String, Object>> getLogs(String projectId);

    RestorationMaterial addMaterial(String projectId, RestorationMaterial material, String operatorId);

    List<RestorationMaterial> listMaterials(String projectId);

    void removeMaterial(String materialId);

    RestorationPhoto addPhoto(String projectId, RestorationPhoto photo);

    List<RestorationPhoto> listPhotos(String projectId);

    List<RestorationPhoto> listPhotosByStage(String projectId, String stage);

    void removePhoto(String photoId);

    Map<String, Object> getStats();
}
