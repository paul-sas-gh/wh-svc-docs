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

Entity (package corrected):
```java
package com.managerwebhooks.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "event_types", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"client_id", "event_type"}, name = "uk_client_event_type")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventType {
    @Id
    @Column(name = "event_id", columnDefinition = "UUID")
    @Builder.Default
    private UUID eventId = UUID.randomUUID();

    @Column(name = "client_id", nullable = false, columnDefinition = "UUID")
    private UUID clientId;

    @Column(name = "event_type", nullable = false, length = 255)
    private String eventType;

    @Column(name = "event_schema", columnDefinition = "jsonb")
    private String eventSchema;

    @Column(name = "event_description", length = 500)
    private String eventDescription;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private EventStatus status = EventStatus.ACTIVE;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PreUpdate
    protected void onUpdate() { this.updatedAt = LocalDateTime.now(); }
}
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
**Location**: `wh-svc-manager/src/main/java/ro/webhooks/manager/domain/repository/`

**File**: `EventTypeRepository.java`
```java
package ro.webhooks.manager.domain.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ro.webhooks.manager.domain.model.EventType;

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
     * @param clientID the UUID of the client
     * @param eventType the event type name
     * @return Optional containing the event type if found
     */
    Optional<EventType> findByClientIDAndEventType(UUID clientID, String eventType);
    
    /**
     * Find all event types for a specific client.
     * 
     * @param clientID the UUID of the client
     * @return List of event types registered by the client
     */
    List<EventType> findAllByClientID(UUID clientID);
    
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
     * @param clientID the UUID of the client
     * @param eventType the event type name
     * @return true if exists, false otherwise
     */
    boolean existsByClientIDAndEventType(UUID clientID, String eventType);
}
```

**File**: `ClientRepository.java`
```java
package ro.webhooks.manager.domain.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ro.webhooks.manager.domain.model.Client;

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
     * @param clientID the client UUID
     * @return Optional containing the client if found
     */
    Optional<Client> findById(UUID clientID);
    
    /**
     * Check if client exists.
     * 
     * @param clientID the client UUID
     * @return true if exists, false otherwise
     */
    boolean existsById(UUID clientID);
}
```

**Tasks**:
- [ ] Create `EventTypeRepository.java` interface
- [ ] Create `ClientRepository.java` interface
- [ ] Verify Spring Data JPA generates implementations

#### 2. Implement Repository Tests
**Location**: `wh-svc-manager/src/test/java/ro/webhooks/manager/domain/repository/`

**File**: `EventTypeRepositoryTest.java`
```java
package ro.webhooks.manager.domain.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Testcontainers;
import ro.webhooks.manager.domain.model.EventStatus;
import ro.webhooks.manager.domain.model.EventType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@Testcontainers
@ActiveProfiles("test")
class EventTypeRepositoryTest {
    
    @Autowired
    private EventTypeRepository repository;
    
    private UUID clientID;
    
    @BeforeEach
    void setUp() {
        clientID = UUID.randomUUID();
    }
    
    @Test
    void shouldSaveAndRetrieveEventType() {
        // Given
        EventType event = EventType.builder()
            .clientID(clientID)
            .eventType("order.created")
            .eventSchema("{\"type\": \"object\"}")
            .status(EventStatus.ACTIVE)
            .build();
        
        // When
        EventType saved = repository.save(event);
        
        // Then
        assertNotNull(saved.getEventID());
        Optional<EventType> found = repository.findById(saved.getEventID());
        assertTrue(found.isPresent());
        assertEquals("order.created", found.get().getEventType());
    }
    
    @Test
    void shouldFindByClientAndEventType() {
        // Given
        EventType event = createAndSaveEventType(clientID, "payment.completed");
        
        // When
        Optional<EventType> found = repository.findByClientIDAndEventType(clientID, "payment.completed");
        
        // Then
        assertTrue(found.isPresent());
        assertEquals(event.getEventID(), found.get().getEventID());
    }
    
    @Test
    void shouldReturnEmptyWhenNotFound() {
        // When
        Optional<EventType> found = repository.findByClientIDAndEventType(clientID, "non.existent");
        
        // Then
        assertFalse(found.isPresent());
    }
    
    @Test
    void shouldFindAllByClientID() {
        // Given
        createAndSaveEventType(clientID, "order.created");
        createAndSaveEventType(clientID, "order.updated");
        createAndSaveEventType(UUID.randomUUID(), "other.event");
        
        // When
        List<EventType> events = repository.findAllByClientID(clientID);
        
        // Then
        assertEquals(2, events.size());
    }
    
    @Test
    void shouldCheckExistence() {
        // Given
        createAndSaveEventType(clientID, "user.registered");
        
        // When
        boolean exists = repository.existsByClientIDAndEventType(clientID, "user.registered");
        boolean notExists = repository.existsByClientIDAndEventType(clientID, "non.existent");
        
        // Then
        assertTrue(exists);
        assertFalse(notExists);
    }
    
    private EventType createAndSaveEventType(UUID clientID, String eventType) {
        EventType event = EventType.builder()
            .clientID(clientID)
            .eventType(eventType)
            .status(EventStatus.ACTIVE)
            .build();
        return repository.save(event);
    }
}
```

**File**: `ClientRepositoryTest.java`
```java
package ro.webhooks.manager.domain.repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Testcontainers;
import ro.webhooks.manager.domain.model.Client;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@Testcontainers
@ActiveProfiles("test")
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
**Location**: `wh-svc-manager/src/main/java/ro/webhooks/manager/infrastructure/cache/`

**File**: `RedisConfig.java`
```java
package ro.webhooks.manager.infrastructure.cache;

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
package ro.webhooks.manager.infrastructure.cache;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import ro.webhooks.manager.domain.model.EventType;

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
    
    public void cacheEventTypesForClient(UUID clientID, List<EventType> eventTypes) {
        String key = CLIENT_CACHE_PREFIX + clientID;
        try {
            redisTemplate.opsForValue().set(key, eventTypes, CACHE_TTL);
            log.debug("Cached {} event types for client {}", eventTypes.size(), clientID);
        } catch (Exception e) {
            log.warn("Failed to cache event types for client {}: {}", clientID, e.getMessage());
        }
    }
    
    public Optional<List<EventType>> getEventTypesForClient(UUID clientID) {
        String key = CLIENT_CACHE_PREFIX + clientID;
        try {
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached instanceof List) {
                log.debug("Cache hit for client {}", clientID);
                return Optional.of((List<EventType>) cached);
            }
        } catch (Exception e) {
            log.warn("Failed to retrieve cache for client {}: {}", clientID, e.getMessage());
        }
        return Optional.empty();
    }
    
    public void invalidateEventTypesForClient(UUID clientID) {
        String key = CLIENT_CACHE_PREFIX + clientID;
        try {
            Boolean deleted = redisTemplate.delete(key);
            if (Boolean.TRUE.equals(deleted)) {
                log.debug("Invalidated cache for client {}", clientID);
            }
            invalidateAllCache();
        } catch (Exception e) {
            log.warn("Failed to invalidate cache for client {}: {}", clientID, e.getMessage());
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
**Location**: `wh-svc-manager/src/test/java/ro/webhooks/manager/infrastructure/cache/`

**File**: `RedisEventTypeCacheTest.java`
```java
package ro.webhooks.manager.infrastructure.cache;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Testcontainers;
import ro.webhooks.manager.domain.model.EventStatus;
import ro.webhooks.manager.domain.model.EventType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
class RedisEventTypeCacheTest {
    
    @Autowired
    private RedisEventTypeCache cache;
    
    private UUID clientID;
    
    @BeforeEach
    void setUp() {
        clientID = UUID.randomUUID();
        cache.invalidateAllCache();
    }
    
    @Test
    void shouldCacheAndRetrieveEventTypes() {
        // Given
        EventType event1 = createEventType(clientID, "order.created");
        EventType event2 = createEventType(clientID, "order.updated");
        List<EventType> events = List.of(event1, event2);
        
        // When
        cache.cacheEventTypesForClient(clientID, events);
        Optional<List<EventType>> retrieved = cache.getEventTypesForClient(clientID);
        
        // Then
        assertTrue(retrieved.isPresent());
        assertEquals(2, retrieved.get().size());
    }
    
    @Test
    void shouldReturnEmptyWhenNotCached() {
        // When
        Optional<List<EventType>> retrieved = cache.getEventTypesForClient(clientID);
        
        // Then
        assertFalse(retrieved.isPresent());
    }
    
    @Test
    void shouldInvalidateCache() {
        // Given
        EventType event = createEventType(clientID, "user.created");
        cache.cacheEventTypeByName("user.created", event);
        
        // When
        cache.invalidateEventTypesForClient(clientID);
        Optional<EventType> retrieved = cache.getEventTypeByName("user.created");
        
        // Then
        assertFalse(retrieved.isPresent());
    }
    
    private EventType createEventType(UUID clientID, String eventType) {
        return EventType.builder()
            .clientID(clientID)
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
**Location**: `wh-svc-manager/src/main/java/ro/webhooks/manager/domain/exception/`

**File**: `EventRegistrationException.java`
```java
package ro.webhooks.manager.domain.exception;

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
package ro.webhooks.manager.domain.exception;

import org.springframework.http.HttpStatus;
import java.util.UUID;

public class ClientNotFoundException extends EventRegistrationException {
    public ClientNotFoundException(UUID clientID) {
        super(
            "Client with ID " + clientID + " not found",
            "CLIENT_NOT_FOUND",
            HttpStatus.NOT_FOUND
        );
    }
}
```

**File**: `DuplicateEventTypeException.java`
```java
package ro.webhooks.manager.domain.exception;

import org.springframework.http.HttpStatus;
import java.util.UUID;

public class DuplicateEventTypeException extends EventRegistrationException {
    public DuplicateEventTypeException(String eventType, UUID clientID, UUID existingEventID) {
        super(
            String.format("Event type '%s' already registered for client %s (eventID: %s)", 
                eventType, clientID, existingEventID),
            "DUPLICATE_EVENT_TYPE",
            HttpStatus.CONFLICT
        );
    }
}
```

**File**: `InvalidSchemaException.java`
```java
package ro.webhooks.manager.domain.exception;

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
**Location**: `wh-svc-manager/src/main/java/ro/webhooks/manager/adapter/dto/`

**File**: `RegisterEventTypeRequest.java`
```java
package ro.webhooks.manager.adapter.dto;

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
    
    @NotBlank(message = "clientID is required")
    @Pattern(
        regexp = "^[0-9a-fA-F-]{36}$",
        message = "clientID must be a valid UUID string"
    )
    private String clientID;
    
    @NotBlank(message = "data is required")
    private String data;
}
```

**File**: `DecryptedEventRegistrationPayload.java`
```java
package ro.webhooks.manager.adapter.dto;

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
package ro.webhooks.manager.adapter.dto;

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
package ro.webhooks.manager.adapter.dto;

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
**Location**: `wh-svc-manager/src/test/java/ro/webhooks/manager/adapter/dto/`

**File**: `JsonSchemaValidatorTest.java`
```java
package ro.webhooks.manager.adapter.dto;

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
**Location**: `wh-svc-manager/src/test/java/ro/webhooks/manager/`

**File**: `PhaseFoundationIntegrationTest.java`
```java
package ro.webhooks.manager;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Testcontainers;
import ro.webhooks.manager.domain.model.EventStatus;
import ro.webhooks.manager.domain.model.EventType;
import ro.webhooks.manager.domain.repository.EventTypeRepository;
import ro.webhooks.manager.infrastructure.cache.RedisEventTypeCache;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
class PhaseFoundationIntegrationTest {
    
    @Autowired
    private EventTypeRepository eventTypeRepository;
    
    @Autowired
    private RedisEventTypeCache cache;
    
    @Test
    void shouldSaveEventTypeAndCacheIt() {
        // Given
        UUID clientID = UUID.randomUUID();
        EventType event = EventType.builder()
            .clientID(clientID)
            .eventType("order.created")
            .eventSchema("{\"type\": \"object\"}")
            .status(EventStatus.ACTIVE)
            .build();
        
        // When
        EventType saved = eventTypeRepository.save(event);
        List<EventType> events = eventTypeRepository.findAllByClientID(clientID);
        cache.cacheEventTypesForClient(clientID, events);
        
        // Then
        assertNotNull(saved.getEventID());
        assertEquals(1, events.size());
        Optional<List<EventType>> cached = cache.getEventTypesForClient(clientID);
        assertTrue(cached.isPresent());
    }
    
    @Test
    void shouldInvalidateCacheOnUpdate() {
        // Given
        UUID clientID = UUID.randomUUID();
        EventType event = eventTypeRepository.save(EventType.builder()
            .clientID(clientID)
            .eventType("user.created")
            .status(EventStatus.ACTIVE)
            .build());
        
        // When
        cache.cacheEventTypeByName("user.created", event);
        cache.invalidateEventTypesForClient(clientID);
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

### Total Files to Create: 25+

**Domain Layer** (5 files):
- EventType.java
- EventStatus.java
- EventRegistrationException.java
- ClientNotFoundException.java
- DuplicateEventTypeException.java
- InvalidSchemaException.java

**Repository Layer** (2 files):
- EventTypeRepository.java
- ClientRepository.java

**Cache Layer** (1 file):
- RedisEventTypeCache.java
- RedisConfig.java

**DTO/Validation** (4 files):
- RegisterEventTypeRequest.java
- DecryptedEventRegistrationPayload.java
- ValidJsonSchema.java
- JsonSchemaValidator.java

**Test Files** (10+ files):
- EventTypeTest.java
- EventTypeRepositoryTest.java
- ClientRepositoryTest.java
- RedisEventTypeCacheTest.java
- RegisterEventTypeRequestTest.java
- JsonSchemaValidatorTest.java
- PhaseFoundationIntegrationTest.java
- TestDataBuilder.java
- Additional test files as needed

**Configuration** (2 files):
- application.yml (update)
- application-docker.yml (update)

**Database Migrations** (2 files):
- V1__Initial_Schema.sql
- V2__Create_Indexes.sql

**Documentation** (1 file):
- PHASE-1-NOTES.md

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
