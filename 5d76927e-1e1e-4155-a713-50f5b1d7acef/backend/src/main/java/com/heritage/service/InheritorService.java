package com.heritage.service;

import com.heritage.entity.ApprenticeRecord;
import com.heritage.entity.Inheritor;
import com.heritage.entity.TrainingSchedule;
import com.heritage.repository.InheritorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class InheritorService {

    @Autowired
    private InheritorRepository inheritorRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    public Page<Inheritor> searchInheritors(String keyword, String region, Pageable pageable) {
        Query query = new Query();

        if (StringUtils.hasText(keyword)) {
            query.addCriteria(Criteria.where("name").regex(keyword, "i"));
        }

        if (StringUtils.hasText(region)) {
            query.addCriteria(Criteria.where("region").regex(region, "i"));
        }

        long total = mongoTemplate.count(query, Inheritor.class);

        query.with(pageable).with(Sort.by(Sort.Direction.DESC, "createdAt"));

        List<Inheritor> list = mongoTemplate.find(query, Inheritor.class);

        return new org.springframework.data.domain.PageImpl<>(list, pageable, total);
    }

    public Optional<Inheritor> findById(String id) {
        return inheritorRepository.findById(id);
    }

    public List<Inheritor> findByHeritageId(String heritageId) {
        return inheritorRepository.findByHeritageIdsContaining(heritageId);
    }

    public List<Inheritor> getInheritanceTree(String inheritorId) {
        List<Inheritor> result = new ArrayList<>();
        collectInheritanceChain(inheritorId, result);
        return result;
    }

    private void collectInheritanceChain(String inheritorId, List<Inheritor> chain) {
        Optional<Inheritor> opt = inheritorRepository.findById(inheritorId);
        if (opt.isEmpty()) return;

        Inheritor current = opt.get();
        if (!chain.contains(current)) {
            chain.add(current);
        }

        if (StringUtils.hasText(current.getMasterId())) {
            collectInheritanceChain(current.getMasterId(), chain);
        }

        List<Inheritor> students = inheritorRepository.findByMasterId(inheritorId);
        for (Inheritor student : students) {
            if (!chain.contains(student)) {
                chain.add(student);
                collectInheritanceChain(student.getId(), chain);
            }
        }
    }

    @Transactional
    public Inheritor createInheritor(Inheritor inheritor) {
        inheritor.setId(null);
        if (inheritor.getBirthDate() != null && inheritor.getAge() == null) {
            inheritor.setAge(Period.between(inheritor.getBirthDate(), LocalDate.now()).getYears());
        }
        if (inheritor.getStudentIds() == null) {
            inheritor.setStudentIds(new ArrayList<>());
        }
        if (inheritor.getHeritageIds() == null) {
            inheritor.setHeritageIds(new ArrayList<>());
        }
        if (inheritor.getApprenticeRecords() == null) {
            inheritor.setApprenticeRecords(new ArrayList<>());
        }
        if (inheritor.getAvailableSchedules() == null) {
            inheritor.setAvailableSchedules(new ArrayList<>());
        }
        return inheritorRepository.save(inheritor);
    }

    @Transactional
    public Inheritor updateInheritor(String id, Inheritor inheritor) {
        Inheritor existing = inheritorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("传承人不存在"));

        existing.setName(inheritor.getName());
        existing.setGender(inheritor.getGender());
        existing.setBirthDate(inheritor.getBirthDate());
        if (inheritor.getBirthDate() != null) {
            existing.setAge(Period.between(inheritor.getBirthDate(), LocalDate.now()).getYears());
        }
        existing.setEthnicity(inheritor.getEthnicity());
        existing.setRegion(inheritor.getRegion());
        existing.setAvatar(inheritor.getAvatar());
        existing.setBio(inheritor.getBio());
        existing.setSkillCharacteristics(inheritor.getSkillCharacteristics());
        existing.setRepresentativeWorks(inheritor.getRepresentativeWorks());
        existing.setMasterId(inheritor.getMasterId());
        existing.setStudentIds(inheritor.getStudentIds());
        existing.setHeritageIds(inheritor.getHeritageIds());
        existing.setApprenticeRecords(inheritor.getApprenticeRecords());
        existing.setAvailableSchedules(inheritor.getAvailableSchedules());
        existing.setPhone(inheritor.getPhone());
        existing.setEmail(inheritor.getEmail());

        return inheritorRepository.save(existing);
    }

    public void deleteInheritor(String id) {
        inheritorRepository.deleteById(id);
    }

    public Inheritor addApprenticeRecord(String inheritorId, ApprenticeRecord record) {
        Inheritor inheritor = inheritorRepository.findById(inheritorId)
                .orElseThrow(() -> new RuntimeException("传承人不存在"));
        inheritor.getApprenticeRecords().add(record);
        inheritor.setApprenticeCount(inheritor.getApprenticeRecords().size());
        return inheritorRepository.save(inheritor);
    }

    public Inheritor addAvailableSchedule(String inheritorId, TrainingSchedule schedule) {
        Inheritor inheritor = inheritorRepository.findById(inheritorId)
                .orElseThrow(() -> new RuntimeException("传承人不存在"));
        inheritor.getAvailableSchedules().add(schedule);
        return inheritorRepository.save(inheritor);
    }

    public List<TrainingSchedule> getAvailableSchedules(String inheritorId) {
        Inheritor inheritor = inheritorRepository.findById(inheritorId)
                .orElseThrow(() -> new RuntimeException("传承人不存在"));
        return inheritor.getAvailableSchedules().stream()
                .filter(TrainingSchedule::isAvailable)
                .toList();
    }
}
