package com.scriptkill.repository;

import com.scriptkill.entity.Deposit;
import com.scriptkill.entity.enums.DepositStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepositRepository extends JpaRepository<Deposit, Long> {

    Optional<Deposit> findByBookingId(Long bookingId);

    List<Deposit> findByPlayerId(Long playerId);

    List<Deposit> findByPlayerIdAndStatus(Long playerId, DepositStatus status);

    List<Deposit> findBySessionId(Long sessionId);

    List<Deposit> findByStatus(DepositStatus status);
}
