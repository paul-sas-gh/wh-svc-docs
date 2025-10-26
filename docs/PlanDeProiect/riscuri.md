---
id: riscuri
title: Managementul Riscurilor
---

| Risc | Probabilitate | Impact | Mitigare |
|------|---------------|--------|----------|
| Single point of failure RabbitMQ | Medie | Ridicat | Cluster HA + quorum queues + monitoring lag |
| Consumatori lenți (slow webhook endpoints) | Medie | Mediu | Timeout, circuit breaker, reîncercări graduale, izolarea consumer pools |
| Vulnerabilități securitate (exposed secrets) | Ridicată | Ridicat | Vault, rotație secrete, scanning dependențe, principle of least privilege |
| Replay attacks | Medie | Ridicat | Nonce + timestamp + fereastră acceptare redusă + curățare Redis |
| Pierderi date crash | Scăzută | Ridicat | Mesaje persistente, backup DB, DLQ analizată regulat |
| Scalare insuficientă la vârf | Medie | Mediu | Autoscaling HPA pe metrici custom, load testing periodic |
| Latențe mari în Dispatcher | Medie | Mediu | Profilare, pooling conexiuni, batching inteligent |

Monitorizare continuă: dashboard metrici (evenimente procesate/sec, rată eroare, timp mediu livrare), alerte (lag cozi, rata DLQ > prag), audit securitate trimestrial.