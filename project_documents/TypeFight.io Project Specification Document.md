# TypeFight.io Project Specification Document

## 1. Executive Summary

**TypeFight.io** is a competitive, browser-based gaming platform that merges high-speed typing mechanics with intense player-vs-player (PvP) and cooperative gameplay. Unlike traditional typing tutors, TypeFight.io treats keyboard input as a weapon and movement mechanism. The platform features four distinct modes: Training, Campaign (RPG), Arena (1v1 Combat), and Multiplayer Racing.

## 2. Scope & Game Modes

### A. The Simulator (Training)

- **Purpose:** Warm-up and skill progression.
    
- **Mechanic:** Endless mode with scaling difficulty. Tracks WPM, accuracy, and reflex speed.
    
- **Utility:** Acts as the "stat-builder" for the player's profile.
    

### B. The Gauntlet (RPG Campaign)

- **Purpose:** PvE progression.
    
- **Mechanic:** Players navigate through "Tiers" of a dungeon. Each enemy has an HP bar tied to word-blocks.
    
- **Progression:** Successful completion grants XP and rare "Key-Skin" collectibles.
    

### C. The Pit (1v1 Combat)

- **Purpose:** PvP Skill-based combat.
    
- **Mechanic:** Typing speed dictates damage output.
    
- **Special Abilities:** Typing "glitch" strings allows players to blind, disrupt, or scramble the opponent's screen.
    

### D. Velocity Highway (Multiplayer Racing)

- **Purpose:** 10-player competitive racing.
    
- **Mechanic:** Real-time socket-based racing. The theme (e.g., Moto, Boat, Car) is decided by lobby vote.
    
- **Penalty:** Typo errors cause engine overheating/stalling.
    

## 3. Technical Architecture

### Tech Stack

- **Frontend:** React.js + TypeScript (High-performance UI rendering).
    
- **Game Engine:** Phaser 3 (For 2D asset rendering and arcade physics).
    
- **Backend:** Node.js + Express (Robust API handling).
    
- **Communication:** Socket.io (Low-latency real-time multiplayer synchronization).
    
- **State Management:** Zustand (Lightweight, efficient state for player stats).
    
- **Database:** PostgreSQL + Redis (Redis for fast-access leaderboards and active session states).
    

### Key Technical Challenges

- **Input Latency:** Bypass default event bubbling; direct `keydown` listener implementation to ensure sub-millisecond input registration.
    
- **Server Authority:** To prevent cheating, keypress validation occurs on the server-side, with optimistic UI updates on the client.
    
- **Scaling:** WebSocket management for 10-player lobbies requires efficient room partitioning.
    

## 4. Feature Roadmap & Milestones

|**Phase**|**Focus**|**Deliverables**|
|---|---|---|
|**Phase 1**|**Core**|Input engine, Player Profile system, The Simulator.|
|**Phase 2**|**Combat**|WebSocket integration, 1v1 Arena mechanics (Glitch attacks).|
|**Phase 3**|**Multiplayer**|Lobby system, voting mechanism, Racing engine (Car/Boat/Moto).|
|**Phase 4**|**RPG**|Campaign mode, DB integration for save-states, Season Pass UI.|

## 5. Economic & Social Ecosystem

- **Season Pass:** Monthly cycles offering cosmetic upgrades (keyboard glow effects, custom vehicle skins).
    
- **Wagering:** Players can stake "Type-Credits" (in-game currency) in matches; winner takes all.
    
- **Clans/Guilds:** Collective WPM scoring. Clan leaderboards to foster community competition.
    
- **Anti-Cheat:** Advanced heuristic analysis on typing patterns (impossible WPM values or robotic timing will flag accounts).
    

## 6. Development Philosophy

- **Competitive Priority:** Every design choice must prioritize competitive integrity.
    
- **Minimalism:** The UI must be sleek and "cyberpunk" themed to reduce distraction.
    
- **Responsiveness:** Must support mobile and tablet input interfaces in future iterations, though focused on PC/Mechanical Keyboard experience initially.
    

_This document serves as the foundation for the TypeFight.io project development. The immediate next step is the initialization of the WebSocket server and the development of the high-speed input listener module._