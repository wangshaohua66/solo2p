package com.carbon.factor.repository;

import com.carbon.common.enums.FactorLibrary;
import com.carbon.factor.entity.FactorChangeLog;
import com.carbon.factor.entity.FactorVersion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactorVersionRepository extends MongoRepository<FactorVersion, String> {

    Optional<FactorVersion> findByLibraryAndVersionCode(FactorLibrary library, String versionCode);

    List<FactorVersion> findByLibraryOrderByReleaseDateDesc(FactorLibrary library);

    Page<FactorVersion> findByLibrary(FactorLibrary library, Pageable pageable);

    Optional<FactorVersion> findFirstByLibraryOrderByReleaseDateDesc(FactorLibrary library);
}

@Repository
interface FactorChangeLogRepository extends MongoRepository<FactorChangeLog, String> {

    List<FactorChangeLog> findByLibraryAndMatchKeyOrderByCreatedAtDesc(
            FactorLibrary library, String matchKey);

    Page<FactorChangeLog> findByLibraryAndVersionTo(FactorLibrary library, String versionTo, Pageable pageable);

    List<FactorChangeLog> findByLibraryAndVersionFromAndVersionTo(
            FactorLibrary library, String versionFrom, String versionTo);
}
