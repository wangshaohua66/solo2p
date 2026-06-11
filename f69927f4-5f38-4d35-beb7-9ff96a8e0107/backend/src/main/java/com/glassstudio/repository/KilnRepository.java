package com.glassstudio.repository;

import com.glassstudio.entity.Kiln;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KilnRepository extends JpaRepository<Kiln, Long> {

    List<Kiln> findByNameContaining(String name);

    List<Kiln> findByType(String type);
}
