package com.mw.scheduling.repository;

import com.mw.scheduling.document.DispatchOrder;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface DispatchOrderRepository extends MongoRepository<DispatchOrder, String> {

    Optional<DispatchOrder> findByOrderNo(String orderNo);
}
