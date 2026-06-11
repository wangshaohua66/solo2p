package com.scriptkill.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scriptkill.dto.common.PageResult;
import com.scriptkill.dto.script.*;
import com.scriptkill.entity.*;
import com.scriptkill.entity.enums.*;
import com.scriptkill.exception.BusinessException;
import com.scriptkill.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ScriptService {

    private final ScriptRepository scriptRepository;
    private final ScriptCharacterRepository characterRepository;
    private final StageRepository stageRepository;
    private final ClueRepository clueRepository;
    private final ObjectMapper objectMapper;

    public ScriptService(ScriptRepository scriptRepository,
                         ScriptCharacterRepository characterRepository,
                         StageRepository stageRepository,
                         ClueRepository clueRepository,
                         ObjectMapper objectMapper) {
        this.scriptRepository = scriptRepository;
        this.characterRepository = characterRepository;
        this.stageRepository = stageRepository;
        this.clueRepository = clueRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ScriptDetailResponse createScript(ScriptCreateRequest request) {
        if (scriptRepository.existsByName(request.getName())) {
            throw new BusinessException("剧本名称已存在");
        }

        Script script = new Script();
        script.setName(request.getName());
        script.setDescription(request.getDescription());
        script.setMinPlayers(request.getMinPlayers());
        script.setMaxPlayers(request.getMaxPlayers());
        script.setEstimatedDurationMinutes(request.getEstimatedDurationMinutes());
        script.setGenre(ScriptGenre.valueOf(request.getGenre()));
        script.setDifficulty(ScriptDifficulty.valueOf(request.getDifficulty()));
        script.setVisibilityLevel(request.getVisibilityLevel() != null ?
                VisibilityLevel.valueOf(request.getVisibilityLevel()) : VisibilityLevel.PUBLIC);
        script.setBackgroundStory(request.getBackgroundStory());
        script.setEndingCount(request.getEndingCount() != null ? request.getEndingCount() : 1);
        script.setCoverImageUrl(request.getCoverImageUrl());
        script.setStatus("ACTIVE");
        script.setVersion(1);

        script = scriptRepository.save(script);

        return getScriptDetail(script.getId());
    }

    @Transactional(readOnly = true)
    public PageResult<ScriptDetailResponse> listScripts(int page, int size, String genre,
                                                        String difficulty, Integer minPlayers,
                                                        Integer maxPlayers) {
        Pageable pageable = PageRequest.of(page, size);

        ScriptGenre genreEnum = genre != null ? ScriptGenre.valueOf(genre) : null;
        ScriptDifficulty difficultyEnum = difficulty != null ? ScriptDifficulty.valueOf(difficulty) : null;

        Page<Script> scriptPage = scriptRepository.searchScripts(
                genreEnum, difficultyEnum, minPlayers, maxPlayers, pageable);

        List<ScriptDetailResponse> content = scriptPage.getContent().stream()
                .map(this::convertToSimpleResponse)
                .collect(Collectors.toList());

        return new PageResult<>(
                content,
                scriptPage.getNumber(),
                scriptPage.getSize(),
                scriptPage.getTotalElements(),
                scriptPage.getTotalPages(),
                scriptPage.hasNext()
        );
    }

    @Transactional(readOnly = true)
    public ScriptDetailResponse getScriptDetail(Long id) {
        Script script = scriptRepository.findById(id)
                .orElseThrow(() -> new BusinessException("剧本不存在"));

        ScriptDetailResponse response = convertToDetailResponse(script);

        List<ScriptCharacter> characters = characterRepository.findByScriptIdOrderBySortOrderAsc(id);
        response.setCharacters(characters.stream()
                .map(this::convertCharacter)
                .collect(Collectors.toList()));

        List<Stage> stages = stageRepository.findByScriptIdOrderByStageOrderAsc(id);
        response.setStages(stages.stream()
                .map(this::convertStage)
                .collect(Collectors.toList()));

        List<Clue> clues = clueRepository.findByScriptIdOrderBySortOrderAsc(id);
        response.setClues(clues.stream()
                .map(this::convertClue)
                .collect(Collectors.toList()));

        return response;
    }

    @Transactional
    public ScriptDetailResponse updateScript(Long id, ScriptCreateRequest request) {
        Script script = scriptRepository.findById(id)
                .orElseThrow(() -> new BusinessException("剧本不存在"));

        createVersionSnapshot(script);

        script.setName(request.getName());
        script.setDescription(request.getDescription());
        script.setMinPlayers(request.getMinPlayers());
        script.setMaxPlayers(request.getMaxPlayers());
        script.setEstimatedDurationMinutes(request.getEstimatedDurationMinutes());
        script.setGenre(ScriptGenre.valueOf(request.getGenre()));
        script.setDifficulty(ScriptDifficulty.valueOf(request.getDifficulty()));
        if (request.getVisibilityLevel() != null) {
            script.setVisibilityLevel(VisibilityLevel.valueOf(request.getVisibilityLevel()));
        }
        script.setBackgroundStory(request.getBackgroundStory());
        if (request.getEndingCount() != null) {
            script.setEndingCount(request.getEndingCount());
        }
        script.setCoverImageUrl(request.getCoverImageUrl());
        script.setVersion(script.getVersion() + 1);

        scriptRepository.save(script);

        return getScriptDetail(id);
    }

    @Transactional
    public void deleteScript(Long id) {
        Script script = scriptRepository.findById(id)
                .orElseThrow(() -> new BusinessException("剧本不存在"));
        script.setStatus("DELETED");
        scriptRepository.save(script);
    }

    private static final int MAX_SNAPSHOTS = 10;

    @Transactional
    public ScriptDetailResponse rollbackToVersion(Long id, Integer version) {
        Script script = scriptRepository.findById(id)
                .orElseThrow(() -> new BusinessException("剧本不存在"));

        if (version == null || version < 1) {
            throw new BusinessException("无效的版本号");
        }

        if (version > script.getVersion()) {
            throw new BusinessException("目标版本号大于当前版本");
        }

        if (script.getVersionSnapshot() == null || script.getVersionSnapshot().isEmpty()) {
            throw new BusinessException("没有历史版本可回滚");
        }

        try {
            List<VersionSnapshotEntry> snapshots = objectMapper.readValue(
                    script.getVersionSnapshot(),
                    new TypeReference<List<VersionSnapshotEntry>>() {});

            VersionSnapshotEntry target = snapshots.stream()
                    .filter(s -> s.version.equals(version))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException("版本 " + version + " 的快照不存在"));

            String snapshotJson = objectMapper.writeValueAsString(target.data);
            Script snapshot = objectMapper.readValue(snapshotJson, Script.class);

            script.setName(snapshot.getName());
            script.setDescription(snapshot.getDescription());
            script.setMinPlayers(snapshot.getMinPlayers());
            script.setMaxPlayers(snapshot.getMaxPlayers());
            script.setEstimatedDurationMinutes(snapshot.getEstimatedDurationMinutes());
            script.setGenre(snapshot.getGenre());
            script.setDifficulty(snapshot.getDifficulty());
            script.setVisibilityLevel(snapshot.getVisibilityLevel());
            script.setBackgroundStory(snapshot.getBackgroundStory());
            script.setEndingCount(snapshot.getEndingCount());
            script.setCoverImageUrl(snapshot.getCoverImageUrl());
            script.setStatus(snapshot.getStatus() != null ? snapshot.getStatus() : "ACTIVE");
            script.setVersion(version);

            scriptRepository.save(script);

            return getScriptDetail(id);
        } catch (BusinessException e) {
            throw e;
        } catch (JsonProcessingException e) {
            throw new BusinessException("版本快照解析失败，无法回滚");
        }
    }

    private void createVersionSnapshot(Script script) {
        try {
            List<VersionSnapshotEntry> snapshots = new ArrayList<>();
            if (script.getVersionSnapshot() != null && !script.getVersionSnapshot().isEmpty()) {
                List<VersionSnapshotEntry> existing = objectMapper.readValue(
                        script.getVersionSnapshot(),
                        new TypeReference<List<VersionSnapshotEntry>>() {});
                snapshots.addAll(existing);
            }

            snapshots.add(new VersionSnapshotEntry(script.getVersion(), script));

            if (snapshots.size() > MAX_SNAPSHOTS) {
                snapshots = snapshots.subList(snapshots.size() - MAX_SNAPSHOTS, snapshots.size());
                snapshots = new ArrayList<>(snapshots);
            }

            script.setVersionSnapshot(objectMapper.writeValueAsString(snapshots));
        } catch (JsonProcessingException e) {
            throw new BusinessException("创建版本快照失败");
        }
    }

    private static class VersionSnapshotEntry {
        public Integer version;
        public Script data;

        public VersionSnapshotEntry() {}

        public VersionSnapshotEntry(Integer version, Script data) {
            this.version = version;
            this.data = data;
        }
    }

    private ScriptDetailResponse convertToSimpleResponse(Script script) {
        ScriptDetailResponse response = new ScriptDetailResponse();
        response.setId(script.getId());
        response.setName(script.getName());
        response.setDescription(script.getDescription());
        response.setMinPlayers(script.getMinPlayers());
        response.setMaxPlayers(script.getMaxPlayers());
        response.setEstimatedDurationMinutes(script.getEstimatedDurationMinutes());
        response.setGenre(script.getGenre().name());
        response.setDifficulty(script.getDifficulty().name());
        response.setVisibilityLevel(script.getVisibilityLevel().name());
        response.setVersion(script.getVersion());
        response.setBackgroundStory(script.getBackgroundStory());
        response.setEndingCount(script.getEndingCount());
        response.setStatus(script.getStatus());
        response.setTotalPlayedCount(script.getTotalPlayedCount());
        response.setAverageRating(script.getAverageRating());
        response.setCoverImageUrl(script.getCoverImageUrl());
        response.setCreatedAt(script.getCreatedAt());
        response.setUpdatedAt(script.getUpdatedAt());
        return response;
    }

    private ScriptDetailResponse convertToDetailResponse(Script script) {
        return convertToSimpleResponse(script);
    }

    private CharacterResponse convertCharacter(ScriptCharacter character) {
        CharacterResponse response = new CharacterResponse();
        response.setId(character.getId());
        response.setName(character.getName());
        response.setGender(character.getGender());
        response.setAgeRange(character.getAgeRange());
        response.setDescription(character.getDescription());
        response.setCharacterStory(character.getCharacterStory());
        response.setSecretInfo(character.getSecretInfo());
        response.setCharacterTrait(character.getCharacterTrait());
        response.setSortOrder(character.getSortOrder());
        response.setIsKiller(character.getIsKiller());
        response.setAvatarUrl(character.getAvatarUrl());
        return response;
    }

    private StageResponse convertStage(Stage stage) {
        StageResponse response = new StageResponse();
        response.setId(stage.getId());
        response.setStageOrder(stage.getStageOrder());
        response.setName(stage.getName());
        response.setDescription(stage.getDescription());
        response.setDurationMinutes(stage.getDurationMinutes());
        response.setStageGoal(stage.getStageGoal());
        response.setVisibilityLevel(stage.getVisibilityLevel().name());
        response.setDmHint(stage.getDmHint());
        response.setEventTrigger(stage.getEventTrigger());
        return response;
    }

    private ClueResponse convertClue(Clue clue) {
        ClueResponse response = new ClueResponse();
        response.setId(clue.getId());
        response.setTitle(clue.getTitle());
        response.setContent(clue.getContent());
        response.setClueLevel(clue.getClueLevel());
        response.setTriggerType(clue.getTriggerType().name());
        response.setTriggerCondition(clue.getTriggerCondition());
        response.setTriggerTimeMinutes(clue.getTriggerTimeMinutes());
        response.setTriggerLocation(clue.getTriggerLocation());
        response.setIsKeyClue(clue.getIsKeyClue());
        response.setSortOrder(clue.getSortOrder());
        response.setImageUrl(clue.getImageUrl());
        response.setDmNote(clue.getDmNote());
        response.setStageId(clue.getStage() != null ? clue.getStage().getId() : null);
        response.setCharacterId(clue.getCharacter() != null ? clue.getCharacter().getId() : null);
        return response;
    }

    @Transactional(readOnly = true)
    public Script getScriptEntity(Long id) {
        return scriptRepository.findById(id)
                .orElseThrow(() -> new BusinessException("剧本不存在"));
    }
}
