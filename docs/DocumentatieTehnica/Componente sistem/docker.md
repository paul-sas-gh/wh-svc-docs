---
id: docker
slug: /DocumentatieTehnica/Componente sistem/docker
title: Docker System
---

# Docker System

Docker System este componenta de orchestrare și rulare a serviciilor din ecosistemul Secure WebHooks. Permite pornirea, oprirea și monitorizarea

## Funcționalități principale
- Orchestrare servicii cu `docker-compose`
- Rețea dedicată pentru comunicație între servicii (`webhooks-network`)
- Health check automat pentru containere
- Scripturi de management (PowerShell și Bash)
- Izolare și portabilitate pentru fiecare componentă

## Structură directoare
```
wh-docker-system/
├── docker-compose.yml     # Orchestrare servicii
├── manage.ps1             # Script PowerShell management
├── manage.sh              # Script Bash management
├── .env.example           # Template variabile mediu
├── README.md              # Documentație detaliată
└── QUICK-START.md         # Ghid rapid
```

## Comenzi uzuale

### Build și pornire servicii
```bash
cd wh-docker-system
docker-compose up -d --build
```

### Oprire servicii
```bash
docker-compose down
```

### Status și logs
```bash
docker-compose ps
docker-compose logs -f
```

### Management rapid (Windows)
```powershell
.\manage.ps1 build   # Build & start
.\manage.ps1 status  # Status
.\manage.ps1 logs    # Logs
.\manage.ps1 down    # Stop
```

### Management rapid (Linux/Mac)
```bash
./manage.sh build
./manage.sh status
./manage.sh logs
./manage.sh down
```

## Adăugare serviciu nou
1. Creează Dockerfile în directorul serviciului
2. Adaugă serviciul în `docker-compose.yml`
3. Rulează `docker-compose up -d --build`

## Recomandări
- Folosește `.env` pentru variabile de mediu sensibile
- Monitorizează health check-urile pentru fiecare container
- Curăță periodic imaginile vechi cu `docker image prune -a`

## Resurse utile
- [Documentație Docker Compose](https://docs.docker.com/compose/)

