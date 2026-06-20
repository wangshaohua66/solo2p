package com.mw.auth.repository;

import com.mw.auth.document.Account;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface AccountRepository extends MongoRepository<Account, String> {

    Optional<Account> findByUsername(String username);

    boolean existsByUsername(String username);
}
