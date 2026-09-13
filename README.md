# 🏨 Hotel AI Customer Service & Reservation System

An intelligent, end-to-end hotel customer service and reservation management platform powered by AI agents, RAG (Retrieval-Augmented Generation), a NestJS backend, and an interactive frontend.

---

## 🌟 Overview

This system streamlines hotel operations and guest interactions by integrating an intelligent AI assistant capable of:
- Answering guest inquiries using **RAG (FAISS + Vector Search)** with hotel knowledge.
- Searching room availability, calculating dynamic pricing, and processing hotel bookings in real-time.
- Handling guest complaints and customer records through direct integration with the reservation backend.

---

## 🏗️ Architecture

```
Customer Services Project
├── 🤖 ai_agent/                 # Python FastAPI AI Agent (LangChain / LLM / RAG FAISS)
├── 🏨 hotel-reservation-system/ # NestJS Backend API & SQLite Database
└── 💻 hotel-frontend/           # Express & Web Frontend Client
```

### 1. 🤖 AI Agent (`ai_agent/`)
- **Framework:** FastAPI, Python 3.10+
- **Features:** Multi-agent routing system (`RouterAgent`, `MainAgent`), FAISS vector database for semantic search, dynamic pricing tool, and hotel backend client integration.
- **Endpoints:** `/api/chat`, `/api/reset`

### 2. 🏨 Hotel Reservation System (`hotel-reservation-system/`)
- **Framework:** NestJS (Node.js & TypeScript), SQLite
- **Modules:**
  - `Rooms`: Room types, availability search, and pricing.
  - `Reservations`: Booking lifecycle management and calculations.
  - `Customers`: Guest profiles and history.
  - `Complaints`: Guest feedback and ticketing system.

### 3. 💻 Frontend (`hotel-frontend/`)
- **Tech Stack:** Node.js, Express, HTML5, CSS3, JavaScript.
- **Features:** Interactive customer chat interface, real-time room availability display, and reservation booking flows.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+ recommended)
- **Python** (v3.10+ recommended)
- **Git**

---

### 1. Setup Backend (NestJS)
```bash
cd hotel-reservation-system
npm install
npm run start:dev
```
> The backend runs on: `http://localhost:3000`

---

### 2. Setup AI Agent (FastAPI)
```bash
cd ai_agent
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python fast_api.py
```
> The AI Agent API runs on: `http://localhost:8000`

---

### 3. Setup Frontend
```bash
cd hotel-frontend
npm install
npm start
```
> Access the frontend interface at: `http://localhost:5000` (or configured port)

---

## 👥 Contributors
- **Ahmed Amr** ([@Ahmedamr200](https://github.com/Ahmedamr200))
-  **Mohanad Omran** ([@Mohanad-omran](https://github.com/Mohanad-omran))
- Project Collaborator

---

## 📄 License
This project is licensed under the MIT License.
