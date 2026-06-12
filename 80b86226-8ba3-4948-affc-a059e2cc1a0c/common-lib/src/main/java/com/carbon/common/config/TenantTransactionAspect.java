package com.carbon.common.config;

import com.carbon.common.context.UserContextHolder;
import com.mongodb.client.ClientSession;
import com.mongodb.client.MongoDatabase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class TenantTransactionAspect {

    private final MongoDatabaseFactory mongoDatabaseFactory;

    @Around("@annotation(com.carbon.common.config.TenantTransactional)")
    public Object aroundTenantTx(ProceedingJoinPoint pjp) throws Throwable {
        if (UserContextHolder.getTenantIdSafe() == null) {
            return pjp.proceed();
        }
        MongoTransactionManager txMgr = new MongoTransactionManager(mongoDatabaseFactory);
        TransactionTemplate tmpl = new TransactionTemplate(txMgr);
        return tmpl.execute(status -> {
            try {
                return pjp.proceed();
            } catch (Throwable t) {
                status.setRollbackOnly();
                if (t instanceof RuntimeException re) throw re;
                if (t instanceof Error e) throw e;
                throw new RuntimeException(t);
            }
        });
    }
}
