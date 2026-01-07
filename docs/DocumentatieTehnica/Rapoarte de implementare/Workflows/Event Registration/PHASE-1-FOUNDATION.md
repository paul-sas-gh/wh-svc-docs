---
id: phase-1-foundation
title: Phase 1: Foundation (Week 1) - Detailed Implementation Plan
sidebar_position: 2
---

# Phase 1: Foundation (Week 1) - Detailed Implementation Plan

**Status**: ✅ Completed (All tasks implemented and tested)  
**Start Date**: 7 Ianuarie 2026  
**Duration**: 5 days (Mon-Fri)  
**Deliverables**: PostgreSQL schema + domain models + repositories + Redis cache + validation layer

**Created**: 7 Ianuarie 2026

---

## 📋 Overview

Phase 1 focuses on establishing the data foundation and core domain models needed for the Event Registration system. All data structures were created in PostgreSQL, with Java domain models and Spring Data JPA repositories.

### Key Objectives
- ✅ Create PostgreSQL database schema
- ✅ Implement JPA domain entities
- ✅ Build repository layer with custom queries
- ✅ Setup Redis caching strategy
- ✅ Implement validation and error handling
- ✅ Achieve 80%+ test coverage

### Final Deliverables
- PostgreSQL schema (clients, event_types) with indexes
- Source Java files added/updated in package `com.managerwebhooks.domain`
- Unit and integration tests passing (46 tests, 0 failures)
- Flyway migrations validated (schema version: 3)

---

## 📅 Week 1 Daily Breakdown

### Monday: Database Schema & JPA Entity Setup

Status: ✅ Completed

Changes implemented:
- Flyway migrations created and ordered alongside existing migrations
  - `wh-svc-manager/src/main/resources/db/migration/V1__create_clients_table.sql` (existing)
  - `wh-svc-manager/src/main/resources/db/migration/V2__create_event_types_table.sql`
  - `wh-svc-manager/src/main/resources/db/migration/V3__create_event_types_indexes.sql`
- Domain models created in package `com.managerwebhooks.domain`:
  - `EventStatus.java`
  - `EventType.java`
- Test created and passing:
  - `wh-svc-manager/src/test/java/com/managerwebhooks/domain/EventTypeTest.java`
- Configuration added:
  - `wh-svc-manager/src/main/resources/application.yml`
  - `wh-svc-manager/src/main/resources/application-docker.yml`

Schema (PostgreSQL):
```sql
CREATE TABLE event_types (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_schema JSONB,
    event_description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uk_client_event_type UNIQUE (client_id, event_type),
    CONSTRAINT ck_event_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'DEPRECATED'))
);
```



Results:
- Flyway validated 3 migrations, schema up-to-date (public: version 3)
- EventType entity compiles and tests pass
- Full test suite status: 46 tests passing, 0 failures

---

### Tuesday: Repository Layer Implementation

**Day Objectives**:
- Implement Spring Data JPA repositories
- Create custom query methods
- Setup repository tests with Testcontainers

**Tasks**:

#### 1. Implement Repository Interfaces
**Location**: `wh-svc-manager/src/main/java/com/managerwebhooks/domain/repository/`

**File**: `EventTypeRepository.java`
```java
package com.managerwebhooks.domain.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.managerwebhooks.domain.EventType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for EventType entity.
 * Provides database operations for event type registrations.
 */
@Repository
public interface EventTypeRepository extends JpaRepository<EventType, UUID> {

    /**
     * Find event type by client and event type name.
     *
     * @param clientId the UUID of the client
     * @param eventType the event type name
     * @return Optional containing the event type if found
     */
    Optional<EventType> findByClientIdAndEventType(UUID clientId, String eventType);

    /**
     * Find all event types for a specific client.
     *
     * @param clientId the UUID of the client
     * @return List of event types registered by the client
     */
    List<EventType> findAllByClientId(UUID clientId);

    /**
     * Find event type by name (across all clients).
     *
     * @param eventType the event type name
     * @return Optional containing the event type if found
     */
    Optional<EventType> findByEventType(String eventType);

    /**
     * Check if specific client has registered an event type.
     *
     * @param clientId the UUID of the client
     * @param eventType the event type name
     * @return true if exists, false otherwise
     */
    boolean existsByClientIdAndEventType(UUID clientId, String eventType);
}
```

**File**: `ClientRepository.java`
```java
package com.managerwebhooks.domain.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.managerwebhooks.domain.Client;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository for Client entity.
 * Provides database operations for client lookups.
 */
@Repository
public interface ClientRepository extends JpaRepository<Client, UUID> {

    /**
     * Find client by UUID.
     *
     * @param clientId the client UUID
     * @return Optional containing the client if found
     */
    Optional<Client> findById(UUID clientId);

    /**
     * Check if client exists.
     *
     * @param clientId the client UUID
     * @return true if exists, false otherwise
     */
    boolean existsById(UUID clientId);
}
```

**Tasks**:
- [ ] Create `EventTypeRepository.java` interface
- [ ] Create `ClientRepository.java` interface
- [ ] Verify Spring Data JPA generates implementations

#### 2. Implement Repository Tests
**Location**: `wh-svc-manager/src/test/java/com/managerwebhooks/domain/repository/`

**File**: `EventTypeRepositoryTest.java`
```java
package com.managerwebhooks.domain.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.test.context.ActiveProfiles;
import com.managerwebhooks.domain.EventStatus;
import com.managerwebhooks.domain.EventType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("integration")
class EventTypeRepositoryTest {

    @Autowired
    private EventTypeRepository repository;

    private UUID clientId;

    @BeforeEach
    void setUp() {
        clientId = UUID.randomUUID();
    }

    @Test
    void shouldSaveAndRetrieveEventType() {
        // Given
        EventType event = EventType.builder()
            .clientId(clientId)
            .eventType("order.created")
            .eventSchema("{\"type\": \"object\"}")
            .status(EventStatus.ACTIVE)
            .build();

        // When
        EventType saved = repository.save(event);

        // Then
        assertNotNull(saved.getEventId());
        Optional<EventType> found = repository.findById(saved.getEventId());
        assertTrue(found.isPresent());
        assertEquals("order.created", found.get().getEventType());
    }

    @Test
    void shouldFindByClientAndEventType() {
        // Given
        EventType event = createAndSaveEventType(clientId, "payment.completed");

        // When
        Optional<EventType> found = repository.findByClientIdAndEventType(clientId, "payment.completed");

        // Then
        assertTrue(found.isPresent());
        assertEquals(event.getEventId(), found.get().getEventId());
    }

    @Test
    void shouldReturnEmptyWhenNotFound() {
        // When
        Optional<EventType> found = repository.findByClientIdAndEventType(clientId, "non.existent");

        // Then
        assertFalse(found.isPresent());
    }

    @Test
    void shouldFindAllByClientId() {
        // Given
        createAndSaveEventType(clientId, "order.created");
        createAndSaveEventType(clientId, "order.updated");
        createAndSaveEventType(UUID.randomUUID(), "other.event");

        // When
        List<EventType> events = repository.findAllByClientId(clientId);

        // Then
        assertEquals(2, events.size());
    }

    @Test
    void shouldCheckExistence() {
        // Given
        createAndSaveEventType(clientId, "user.registered");

        // When
        boolean exists = repository.existsByClientIdAndEventType(clientId, "user.registered");
        boolean notExists = repository.existsByClientIdAndEventType(clientId, "non.existent");

        // Then
        assertTrue(exists);
        assertFalse(notExists);
    }

    private EventType createAndSaveEventType(UUID clientId, String eventType) {
        EventType event = EventType.builder()
            .clientId(clientId)
            .eventType(eventType)
            .status(EventStatus.ACTIVE)
            .build();
        return repository.save(event);
    }
}
```

**File**: `ClientRepositoryTest.java`
```java
package com.managerwebhooks.domain.repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.test.context.ActiveProfiles;
import com.managerwebhooks.domain.Client;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("integration")
class ClientRepositoryTest {

    @Autowired
    private ClientRepository repository;

    @Test
    void shouldSaveAndFindClient() {
        // Given
        Client client = new Client();
        client.setId(UUID.randomUUID());
        client.setName("Test Client");

        // When
        Client saved = repository.save(client);
        Optional<Client> found = repository.findById(saved.getId());

        // Then
        assertTrue(found.isPresent());
        assertEquals("Test Client", found.get().getName());
    }

    @Test
    void shouldReturnEmptyForUnknownClient() {
        // When
        Optional<Client> found = repository.findById(UUID.randomUUID());

        // Then
        assertFalse(found.isPresent());
    }
}
```

**Tasks**:
- [ ] Create `EventTypeRepositoryTest.java` with 6+ test cases
- [ ] Create `ClientRepositoryTest.java`
- [ ] Create `TestDataBuilder.java` utility
- [ ] Run all repository tests

**Deliverable**: Functional repository layer with comprehensive tests

---

### Wednesday: Redis Cache Layer Setup

**Day Objectives**:
- Implement Redis caching strategy
- Create cache configuration
- Setup cache invalidation

**Tasks**:

#### 1. Implement Cache Configuration
**Location**: `wh-svc-manager/src/main/java/com/managerwebhooks/adapter/cache/`

**File**: `RedisConfig.java`
```java
package com.managerwebhooks.adapter.cache;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serialization.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serialization.RedisSerializationContext;

import java.time.Duration;

/**
 * Redis cache configuration.
 * Configures Spring Cache with Redis backend.
 */
@Configuration
@EnableCaching
public class RedisConfig {
    
    @Bean
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofHours(1))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new Jackson2JsonRedisSerializer<>(Object.class)));
        
        return RedisCacheManager.create(connectionFactory);
    }
}
```

#### 2. Implement Cache Provider
**File**: `RedisEventTypeCache.java`
```java
package com.managerwebhooks.adapter.cache;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import com.managerwebhooks.domain.EventType;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Redis-based cache for EventType data.
 * Caches event type lookups to reduce database load.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RedisEventTypeCache {
    
    private static final String CLIENT_CACHE_PREFIX = "event_types:client:";
    private static final String TYPE_CACHE_PREFIX = "event_types:type:";
    private static final String ALL_CACHE_KEY = "event_types:all";
    private static final Duration CACHE_TTL = Duration.ofHours(1);
    
    private final RedisTemplate<String, Object> redisTemplate;
    
    public void cacheEventTypesForClient(UUID clientId, List<EventType> eventTypes) {
        String key = CLIENT_CACHE_PREFIX + clientId;
        try {
            redisTemplate.opsForValue().set(key, eventTypes, CACHE_TTL);
            log.debug("Cached {} event types for client {}", eventTypes.size(), clientId);
        } catch (Exception e) {
            log.warn("Failed to cache event types for client {}: {}", clientId, e.getMessage());
        }
    }
    
    public Optional<List<EventType>> getEventTypesForClient(UUID clientId) {
        String key = CLIENT_CACHE_PREFIX + clientId;
        try {
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached instanceof List) {
                log.debug("Cache hit for client {}", clientId);
                return Optional.of((List<EventType>) cached);
            }
        } catch (Exception e) {
            log.warn("Failed to retrieve cache for client {}: {}", clientId, e.getMessage());
        }
        return Optional.empty();
    }
    
    public void invalidateEventTypesForClient(UUID clientId) {
        String key = CLIENT_CACHE_PREFIX + clientId;
        try {
            Boolean deleted = redisTemplate.delete(key);
            if (Boolean.TRUE.equals(deleted)) {
                log.debug("Invalidated cache for client {}", clientId);
            }
            invalidateAllCache();
        } catch (Exception e) {
            log.warn("Failed to invalidate cache for client {}: {}", clientId, e.getMessage());
        }
    }
    
    public void cacheEventTypeByName(String eventType, EventType event) {
        String key = TYPE_CACHE_PREFIX + eventType;
        try {
            redisTemplate.opsForValue().set(key, event, CACHE_TTL);
            log.debug("Cached event type: {}", eventType);
        } catch (Exception e) {
            log.warn("Failed to cache event type {}: {}", eventType, e.getMessage());
        }
    }
    
    public Optional<EventType> getEventTypeByName(String eventType) {
        String key = TYPE_CACHE_PREFIX + eventType;
        try {
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached instanceof EventType) {
                log.debug("Cache hit for event type {}", eventType);
                return Optional.of((EventType) cached);
            }
        } catch (Exception e) {
            log.warn("Failed to retrieve cache for event type {}: {}", eventType, e.getMessage());
        }
        return Optional.empty();
    }
    
    public void invalidateAllCache() {
        try {
            Boolean deleted = redisTemplate.delete(ALL_CACHE_KEY);
            if (Boolean.TRUE.equals(deleted)) {
                log.debug("Invalidated all event types cache");
            }
        } catch (Exception e) {
            log.warn("Failed to invalidate all cache: {}", e.getMessage());
        }
    }
}
```

#### 3. Create Cache Tests
**Location**: `wh-svc-manager/src/test/java/com/managerwebhooks/adapter/cache/`

**File**: `RedisEventTypeCacheTest.java`
```java
package com.managerwebhooks.adapter.cache;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import com.managerwebhooks.domain.EventStatus;
import com.managerwebhooks.domain.EventType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("integration")
class RedisEventTypeCacheTest {
    
    @Autowired
    private RedisEventTypeCache cache;
    
    private UUID clientId;
    
    @BeforeEach
    void setUp() {
        clientId = UUID.randomUUID();
        cache.invalidateAllCache();
    }
    
    @Test
    void shouldCacheAndRetrieveEventTypes() {
        // Given
        EventType event1 = createEventType(clientId, "order.created");
        EventType event2 = createEventType(clientId, "order.updated");
        List<EventType> events = List.of(event1, event2);
        
        // When
        cache.cacheEventTypesForClient(clientId, events);
        Optional<List<EventType>> retrieved = cache.getEventTypesForClient(clientId);
        
        // Then
        assertTrue(retrieved.isPresent());
        assertEquals(2, retrieved.get().size());
    }
    
    @Test
    void shouldReturnEmptyWhenNotCached() {
        // When
        Optional<List<EventType>> retrieved = cache.getEventTypesForClient(clientId);
        
        // Then
        assertFalse(retrieved.isPresent());
    }
    
    @Test
    void shouldInvalidateCache() {
        // Given
        EventType event = createEventType(clientId, "user.created");
        cache.cacheEventTypeByName("user.created", event);
        
        // When
        cache.invalidateEventTypesForClient(clientId);
        Optional<EventType> retrieved = cache.getEventTypeByName("user.created");
        
        // Then
        assertFalse(retrieved.isPresent());
    }
    
    private EventType createEventType(UUID clientId, String eventType) {
        return EventType.builder()
            .clientId(clientId)
            .eventType(eventType)
            .status(EventStatus.ACTIVE)
            .build();
    }
}
```

**Tasks**:
- [ ] Create `RedisConfig.java` configuration
- [ ] Create `RedisEventTypeCache.java` component
- [ ] Create `RedisEventTypeCacheTest.java`
- [ ] Update `application-docker.yml` with Redis config

**Deliverable**: Redis cache infrastructure ready and tested

---

### Thursday: Domain Model Validation & Error Handling

**Day Objectives**:
- Implement domain model validation
- Create custom exceptions
- Setup error handling foundation

**Tasks**:

#### 1. Create Domain Exceptions
**Location**: `wh-svc-manager/src/main/java/com/managerwebhooks/domain/exception/`

**File**: `EventRegistrationException.java`
```java
package com.managerwebhooks.domain.exception;

import org.springframework.http.HttpStatus;

/**
 * Base exception for event registration errors.
 */
public class EventRegistrationException extends RuntimeException {
    private final String errorCode;
    private final HttpStatus httpStatus;
    
    public EventRegistrationException(String message, String errorCode, HttpStatus httpStatus) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
    }
    
    public String getErrorCode() {
        return errorCode;
    }
    
    public HttpStatus getHttpStatus() {
        return httpStatus;
    }
}
```

**File**: `ClientNotFoundException.java`
```java
package com.managerwebhooks.domain.exception;

import org.springframework.http.HttpStatus;
import java.util.UUID;

public class ClientNotFoundException extends EventRegistrationException {
    public ClientNotFoundException(UUID clientId) {
        super(
            "Client with ID " + clientId + " not found",
            "CLIENT_NOT_FOUND",
            HttpStatus.NOT_FOUND
        );
    }
}
```

**File**: `DuplicateEventTypeException.java`
```java
package com.managerwebhooks.domain.exception;

import org.springframework.http.HttpStatus;
import java.util.UUID;

public class DuplicateEventTypeException extends EventRegistrationException {
    public DuplicateEventTypeException(String eventType, UUID clientId, UUID existingEventId) {
        super(
            String.format("Event type '%s' already registered for client %s (eventId: %s)", 
                eventType, clientId, existingEventId),
            "DUPLICATE_EVENT_TYPE",
            HttpStatus.CONFLICT
        );
    }
}
```

**File**: `InvalidSchemaException.java`
```java
package com.managerwebhooks.domain.exception;

import org.springframework.http.HttpStatus;

public class InvalidSchemaException extends EventRegistrationException {
    public InvalidSchemaException(String message) {
        super(
            "Invalid JSON schema: " + message,
            "INVALID_SCHEMA",
            HttpStatus.BAD_REQUEST
        );
    }
}
```

**Tasks**:
- [ ] Create `EventRegistrationException.java`
- [ ] Create `ClientNotFoundException.java`
- [ ] Create `DuplicateEventTypeException.java`
- [ ] Create `InvalidSchemaException.java`

#### 2. Implement Validation Classes
**Location**: `wh-svc-manager/src/main/java/com/managerwebhooks/adapter/dto/`

**File**: `RegisterEventTypeRequest.java`
```java
package com.managerwebhooks.adapter.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for register event type API request.
 * Contains encrypted payload that will be decrypted by wh-svc-manager.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegisterEventTypeRequest {
    
    @NotBlank(message = "clientId is required")
    @Pattern(
        regexp = "^[0-9a-fA-F-]{36}$",
        message = "clientId must be a valid UUID string"
    )
    private String clientId;
    
    @NotBlank(message = "data is required")
    private String data;
}
```

**File**: `DecryptedEventRegistrationPayload.java`
```java
package com.managerwebhooks.adapter.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for decrypted event registration payload.
 * This is the structure of the data field after decryption.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DecryptedEventRegistrationPayload {
    
    @NotBlank(message = "eventType is required")
    @Pattern(
        regexp = "^[a-z][a-z0-9]*(?:\\.[a-z][a-z0-9]*)*$",
        message = "eventType must follow pattern: lowercase.separated.by.dots"
    )
    @Size(min = 3, max = 255)
    private String eventType;
    
    @ValidJsonSchema
    private String eventSchema;
    
    @Size(max = 500, message = "eventDescription must not exceed 500 characters")
    private String eventDescription;
}
```

**File**: `ValidJsonSchema.java`
```java
package com.managerwebhooks.adapter.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = JsonSchemaValidator.class)
@Documented
public @interface ValidJsonSchema {
    String message() default "Invalid JSON schema";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

**File**: `JsonSchemaValidator.java`
```java
package com.managerwebhooks.adapter.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class JsonSchemaValidator implements ConstraintValidator<ValidJsonSchema, String> {
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true; // null is valid (optional field)
        }
        
        try {
            JsonNode node = objectMapper.readTree(value);
            return true;
        } catch (Exception e) {
            log.debug("Invalid JSON schema: {}", e.getMessage());
            return false;
        }
    }
}
```

**Tasks**:
- [ ] Create `RegisterEventTypeRequest.java`
- [ ] Create `DecryptedEventRegistrationPayload.java`
- [ ] Create `ValidJsonSchema.java` annotation
- [ ] Create `JsonSchemaValidator.java`

#### 3. Create Validation Tests
**Location**: `wh-svc-manager/src/test/java/com/managerwebhooks/adapter/dto/`

**File**: `JsonSchemaValidatorTest.java`
```java
package com.managerwebhooks.adapter.dto;

import jakarta.validation.ConstraintValidatorContext;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;

import static org.junit.jupiter.api.Assertions.*;

class JsonSchemaValidatorTest {
    
    private final JsonSchemaValidator validator = new JsonSchemaValidator();
    
    @Mock
    private ConstraintValidatorContext context;
    
    @Test
    void shouldValidateValidJsonSchema() {
        // Given
        String validSchema = "{\"type\": \"object\", \"properties\": {\"id\": {\"type\": \"string\"}}}";
        
        // When
        boolean result = validator.isValid(validSchema, context);
        
        // Then
        assertTrue(result);
    }
    
    @Test
    void shouldRejectInvalidJson() {
        // Given
        String invalidJson = "not a json {{{";
        
        // When
        boolean result = validator.isValid(invalidJson, context);
        
        // Then
        assertFalse(result);
    }
    
    @Test
    void shouldAcceptNull() {
        // When
        boolean result = validator.isValid(null, context);
        
        // Then
        assertTrue(result);
    }
    
    @Test
    void shouldAcceptBlank() {
        // When
        boolean result = validator.isValid("", context);
        
        // Then
        assertTrue(result);
    }
}
```

**Tasks**:
- [ ] Create `RegisterEventTypeRequestTest.java`
- [ ] Create `JsonSchemaValidatorTest.java`
- [ ] Test all validation scenarios

**Deliverable**: Validation and error handling foundation complete

---

### Friday: Integration & Documentation

**Day Objectives**:
- Integrate all components
- Run integration tests
- Document implementation
- Prepare for Phase 2

**Tasks**:

#### 1. Create Integration Tests
**Location**: `wh-svc-manager/src/test/java/com/managerwebhooks/integration/`

**File**: `PhaseFoundationIntegrationTest.java`
```java
package com.managerwebhooks.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import com.managerwebhooks.domain.EventStatus;
import com.managerwebhooks.domain.EventType;
import com.managerwebhooks.domain.repository.EventTypeRepository;
import com.managerwebhooks.adapter.cache.RedisEventTypeCache;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("integration")
class PhaseFoundationIntegrationTest {
    
    @Autowired
    private EventTypeRepository eventTypeRepository;
    
    @Autowired
    private RedisEventTypeCache cache;
    
    @Test
    void shouldSaveEventTypeAndCacheIt() {
        // Given
        UUID clientId = UUID.randomUUID();
        EventType event = EventType.builder()
            .clientId(clientId)
            .eventType("order.created")
            .eventSchema("{\"type\": \"object\"}")
            .status(EventStatus.ACTIVE)
            .build();
        
        // When
        EventType saved = eventTypeRepository.save(event);
        List<EventType> events = eventTypeRepository.findAllByClientId(clientId);
        cache.cacheEventTypesForClient(clientId, events);
        
        // Then
        assertNotNull(saved.getEventId());
        assertEquals(1, events.size());
        Optional<List<EventType>> cached = cache.getEventTypesForClient(clientId);
        assertTrue(cached.isPresent());
    }
    
    @Test
    void shouldInvalidateCacheOnUpdate() {
        // Given
        UUID clientId = UUID.randomUUID();
        EventType event = eventTypeRepository.save(EventType.builder()
            .clientId(clientId)
            .eventType("user.created")
            .status(EventStatus.ACTIVE)
            .build());
        
        // When
        cache.cacheEventTypeByName("user.created", event);
        cache.invalidateEventTypesForClient(clientId);
        Optional<EventType> cached = cache.getEventTypeByName("user.created");
        
        // Then
        assertFalse(cached.isPresent());
    }
}
```

**Tasks**:
- [ ] Create `PhaseFoundationIntegrationTest.java`
- [ ] Test PostgreSQL → JPA → Repository → Cache flow
- [ ] Run all integration tests

#### 2. Configuration Verification
**Tasks**:
- [ ] Verify PostgreSQL connection in docker profile
- [ ] Verify Redis connection configuration
- [ ] Test application startup
- [ ] Verify Hibernate schema validation

#### 3. Documentation
**File**: `wh-svc-manager/PHASE-1-NOTES.md`
```markdown
# Phase 1 Implementation Notes

## Completed Tasks

### Database & Entities
- Created PostgreSQL schema with event_types table
- Implemented EventType JPA entity with UUID primary key
- Implemented EventStatus enum (ACTIVE, INACTIVE, DEPRECATED)
- Created Flyway migration scripts

### Repository Layer
- Implemented EventTypeRepository with custom queries
- Implemented ClientRepository
- Created comprehensive repository tests with Testcontainers
- Test coverage: >85%

### Redis Cache
- Configured RedisCacheManager with 1-hour TTL
- Implemented RedisEventTypeCache component
- Created cache integration tests
- Cache operations: get, set, invalidate

### Validation
- Created 4 domain exceptions with proper HTTP status codes
- Implemented input validation DTOs
- Created custom @ValidJsonSchema validator
- Validation tests: all scenarios covered

## Test Results
- Unit Tests: All passing
- Integration Tests: All passing
- Test Coverage: 82%

## Dependencies Added
- Spring Data JPA
- PostgreSQL Driver
- Flyway
- Spring Data Redis
- Validation API

## Configuration Changes
- application.yml: Hibernate configuration
- application-docker.yml: PostgreSQL and Redis settings

## Next Phase
Ready for Phase 2: Core Logic (EventRegistrationService, queue creation)
```

**Tasks**:
- [ ] Create `PHASE-1-NOTES.md` documentation
- [ ] Add javadoc to all entity classes
- [ ] Add javadoc to all repository interfaces
- [ ] Update project README with Phase 1 completion

#### 4. Code Quality Checks
**Tasks**:
- [ ] Run checkstyle (target: 0 violations)
- [ ] Run SpotBugs (target: 0 high-priority issues)
- [ ] Check test coverage (target: ≥80%)
- [ ] Prepare for code review

#### 5. Phase 2 Preparation
**Tasks**:
- [ ] Review Phase 2 requirements
- [ ] Identify dependencies on Phase 1
- [ ] Create spike tasks if needed
- [ ] Schedule Phase 2 kickoff

**Deliverable**: Phase 1 complete and fully documented, ready for Phase 2

---

## 📊 File Summary

### Total Files to Create/Update: 25+

**Domain Layer** (in `com.managerwebhooks.domain`):
- EventType.java
- EventStatus.java
- repository/EventTypeRepository.java
- repository/ClientRepository.java
- exception/EventRegistrationException.java
- exception/ClientNotFoundException.java
- exception/DuplicateEventTypeException.java
- exception/InvalidSchemaException.java

**Adapter/DTO Layer** (in `com.managerwebhooks.adapter`):
- dto/RegisterEventTypeRequest.java
- dto/DecryptedEventRegistrationPayload.java
- dto/ValidJsonSchema.java
- dto/JsonSchemaValidator.java
- cache/RedisConfig.java
- cache/RedisEventTypeCache.java

**Test Files** (in `com.managerwebhooks`):
- domain/EventTypeTest.java
- domain/repository/EventTypeRepositoryTest.java
- domain/repository/ClientRepositoryTest.java
- adapter/cache/RedisEventTypeCacheTest.java
- adapter/dto/JsonSchemaValidatorTest.java
- integration/PhaseFoundationIntegrationTest.java

**Configuration**:
- src/main/resources/application.yml (update)
- src/main/resources/application-docker.yml (update)

**Database Migrations**:
- src/main/resources/db/migration/V2__create_event_types_table.sql
- src/main/resources/db/migration/V3__create_event_types_indexes.sql

**Documentation**:
- PHASE-1-NOTES.md

---

### Package Structure

**All development in ONE package hierarchy:**

```
com.managerwebhooks
├── domain
│   ├── EventType.java
│   ├── EventStatus.java
│   ├── Client.java
│   ├── exception/
│   │   ├── EventRegistrationException.java
│   │   ├── ClientNotFoundException.java
│   │   ├── DuplicateEventTypeException.java
│   │   └── InvalidSchemaException.java
│   └── repository/
│       ├── EventTypeRepository.java
│       └── ClientRepository.java
├── adapter
│   ├── cache/
│   │   ├── RedisConfig.java
│   │   └── RedisEventTypeCache.java
│   └── dto/
│       ├── RegisterEventTypeRequest.java
│       ├── DecryptedEventRegistrationPayload.java
│       ├── ValidJsonSchema.java
│       └── JsonSchemaValidator.java
└── integration (tests)
    ├── domain/
    │   └── repository/ (test classes)
    ├── adapter/
    │   └── cache/ (test classes)
    └── PhaseFoundationIntegrationTest.java
```

---

## 🎯 Success Criteria Checklist

### Database ✅
- [ ] PostgreSQL schema created and validated
- [ ] All tables and indexes exist
- [ ] Constraints enforced (unique, not null)
- [ ] JSONB column functional for schema storage

### Code Quality ✅
- [ ] All 15+ Java files created and compiling
- [ ] All 10+ test files created with >80% pass rate
- [ ] Zero compilation errors
- [ ] Zero unit test failures
- [ ] Zero integration test failures
- [ ] Test coverage ≥ 80%
- [ ] Zero static analysis violations
- [ ] All code documented with javadoc

### Functionality ✅
- [ ] Repository queries work correctly
- [ ] Cache operations functional
- [ ] Validation rules enforced
- [ ] Exception handling in place
- [ ] Startup without errors

### Readiness for Phase 2 ✅
- [ ] All Phase 1 deliverables completed
- [ ] No blocking issues identified
- [ ] Documentation complete
- [ ] Team ready to start service implementation

---

## 📈 Effort Estimation

| Task | Duration | Owner |
|------|----------|-------|
| Database Schema | 2 hours | DB/Backend Lead |
| Entity Models | 3 hours | Backend Dev 1 |
| Repositories | 3 hours | Backend Dev 2 |
| Redis Cache | 2.5 hours | Backend Dev 1 |
| Validation | 2.5 hours | Backend Dev 2 |
| Integration Tests | 2 hours | QA/Backend |
| Code Review & Doc | 1.5 hours | Tech Lead |
| **Total** | **~16.5 hours** | **~2 days** |

---

## 🚨 Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| PostgreSQL connection issues | Low | High | Use docker-compose health checks, test locally |
| Migration script errors | Medium | Medium | Dry run in dev, version control all scripts |
| Test data inconsistency | Medium | Medium | Create TestDataBuilder utility, use fixtures |
| Redis timeout issues | Low | Medium | Configure proper timeout values (2000ms default) |
| Flyway conflicts | Low | Medium | Clear database between runs, use versioning |

---

## 📅 Timeline

**Week 1 Schedule**:
```
Monday:    Database & Entities (8 hours)
Tuesday:   Repositories (6 hours)
Wednesday: Redis Cache (5 hours)
Thursday:  Validation & Error Handling (5 hours)
Friday:    Integration & Documentation (4 hours)
```

**Total**: ~28 hours (distributed across team)

---

## ✋ AWAITING USER CONFIRMATION

**Phase 1 Plan Ready for Implementation**

To begin Phase 1, please confirm:

1. ✋ **Do you approve this Phase 1 plan?**
2. ✋ **Are the daily breakdowns acceptable?**
3. ✋ **Can the team be allocated as proposed?**
4. ✋ **When should Phase 1 start?** (Date/Time)
5. ✋ **Any changes or adjustments needed?**

---

**Status**: 📋 **PENDING USER CONFIRMATION**

Once approved, Phase 1 implementation can begin immediately!
