---
id: security-service-stack
slug: /DocumentatieTehnica/SecurityService/technology-stack
title: Stack tehnologic
---

# Stack tehnologic

Această pagină prezintă tehnologiile și configurațiile folosite pentru modulul `wh-svc-security`.

## Principale tehnologii

- Java 21 (LTS) — limbajul folosit pentru compilare și runtime. Proiectul este construit și rulat folosind JDK 21.
- Spring Boot 3.5.0 — versiunea parent care gestionează BOM-ul și dependency management-ul.
- Spring Security (gestionat de Spring Boot BOM) — pentru autentificare și autorizare.
- Spring Web (Spring MVC) — pentru expunerea endpoint-urilor REST.
- SpringDoc OpenAPI — `org.springdoc:springdoc-openapi-starter-webmvc-ui` folosit pentru generarea documentației OpenAPI și Swagger UI.
- Maven — sistemul de build (pom.xml). Utilizăm `mvn package` și `mvn spring-boot:run` pentru rulare locală.

## Versiuni relevante (actuale)

- Spring Boot: 3.5.0
- Java: 21
- SpringDoc OpenAPI starter: 2.6.0 (sau cea compatibilă cu Spring Boot 3.5)

## Considerații de rulare

- Setează `JAVA_HOME` la JDK 21 înainte de a rula build-ul sau aplicația:

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-21'
mvn -DskipTests spring-boot:run
```

- Dacă întâlnești erori legate de Bean Validation la pornire (ex: "NoProviderFoundException"), adaugă `org.hibernate.validator:hibernate-validator` în `pom.xml` pentru a furniza o implementare Jakarta Validation.



## Changelog

Vezi `wh-svc-security/CHANGELOG.md` în repository pentru intrările detaliate despre upgrade-uri și modificări.
