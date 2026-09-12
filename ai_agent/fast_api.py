from typing import Dict
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.main_agent import MainAgent

app = FastAPI(title="Hotel AI Agent")

# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# MULTI-USER SESSION MANAGER
# ============================================================

# Dict to store separate agent instances per user_id
user_sessions: Dict[str, MainAgent] = {}

def get_or_create_agent(user_id: str) -> MainAgent:
    """Retrieve existing user agent instance or create a new one."""
    if user_id not in user_sessions:
        user_sessions[user_id] = MainAgent()
    return user_sessions[user_id]


# ============================================================
# REQUEST MODELS
# ============================================================

class ChatRequest(BaseModel):
    user_id: str
    message: str


class ResetRequest(BaseModel):
    user_id: str


# ============================================================
# CHAT ENDPOINT
# ============================================================

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Get isolated agent instance for this user
        agent = get_or_create_agent(request.user_id)

        # Process message
        result = agent.handle_message(request.message)

        return {
            "success": True,
            "user_id": request.user_id,
            "action": result.get("action"),
            "message": result.get("message"),
            "result": result.get("result"),
            "state": result.get("state"),
        }

    except Exception as e:
        print("AI ERROR:", repr(e))
        return {
            "success": False,
            "message": "Sorry, something went wrong with the AI Agent.",
            "error": str(e),
        }


# ============================================================
# RESET ENDPOINT
# ============================================================

@app.post("/api/reset")
async def reset(request: ResetRequest):
    try:
        if request.user_id in user_sessions:
            user_sessions[request.user_id].reset()
            # Optional: delete session completely -> del user_sessions[request.user_id]

        return {
            "success": True,
            "user_id": request.user_id,
            "message": "Conversation reset successfully."
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Hotel AI Agent"
    }


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "fast_api:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )