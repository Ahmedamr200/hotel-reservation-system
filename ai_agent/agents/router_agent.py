from typing import Any, Dict, List, Optional

from llm.llm_service import LLMService


class RouterAgent:
    """
    Main router responsible for understanding the user's intent
    and deciding which part of the hotel system should handle it.

    The Router does NOT:
    - access the database
    - call the hotel backend directly
    - perform reservations
    - perform cancellations
    - search FAISS directly

    It only:
    1. Uses the real LLM to classify the request.
    2. Can use conversation history.
    3. Returns a clean routing result.
    """

    VALID_INTENTS = {
        "hotel_information",
        "check_availability",
        "find_customer",
        "calculate_price",
        "create_reservation",
        "cancel_reservation",
        "complaint",
        "unknown",
    }

    def __init__(
        self,
        llm: Optional[LLMService] = None,
    ):
        """
        Allow dependency injection.

        Example:

            router = RouterAgent()

        or:

            llm = LLMService()
            router = RouterAgent(llm)
        """

        self.llm = llm or LLMService()

    # =========================================================
    # CLASSIFY INTENT
    # =========================================================

    def classify(
        self,
        message: str,
        history: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """
        Classify the user's message into exactly one intent.

        history:
            Previous conversation messages.

        This is important because the user may say:

            User:
            I want a double room.

            User:
            From November 10 to November 14.

        The second message needs the previous context.
        """

        if not message or not message.strip():
            return "unknown"

        history = history or []

        system_prompt = """
You are the main intent classifier for a hotel reservation
AI assistant.

Your job is to classify the user's CURRENT message into
EXACTLY ONE of the following intents:

hotel_information
check_availability
find_customer
calculate_price
create_reservation
cancel_reservation
complaint
unknown

=========================================================
INTENT DEFINITIONS
=========================================================

hotel_information:
Questions about hotel information, facilities, services,
WiFi, spa, pool, restaurant, gym, check-in, check-out,
family facilities, hotel policies, location, etc.

check_availability:
The user wants to search, find, check, or see available
rooms.

Examples:
- What rooms are available?
- Do you have a double room?
- Is room 101 available?
- Show me available rooms.

find_customer:
The user wants to find, identify, or retrieve an existing
customer.

calculate_price:
The user asks about room price, cost, total price,
nightly price, stay cost, or discounts.

create_reservation:
The user explicitly wants to make, create, or book a
reservation.

Examples:
- Book a room for me.
- I want to make a reservation.
- Reserve room 101.

cancel_reservation:
The user wants to cancel a reservation or booking.

complaint:
The user reports a problem, bad service, dirty room,
missing service, or another hotel-related complaint.

unknown:
Greetings, unrelated questions, unclear requests, or
anything that does not match the categories above.

=========================================================
IMPORTANT CONTEXT RULE
=========================================================

Use the conversation history when necessary.

For example:

Previous:
User: I want a double room.

Current:
User: From November 10 to November 14.

The current message is related to room booking/availability,
not unknown.

However, classify the CURRENT user request based on its
meaning and the available context.

=========================================================
OUTPUT RULE
=========================================================

Return ONLY ONE intent name.

Do NOT explain.
Do NOT use JSON.
Do NOT add punctuation.
Do NOT add markdown.

Possible outputs:

hotel_information
check_availability
find_customer
calculate_price
create_reservation
cancel_reservation
complaint
unknown
"""

        # -----------------------------------------------------
        # Build messages for the LLM
        # -----------------------------------------------------

        messages: List[Dict[str, Any]] = [
            {
                "role": "system",
                "content": system_prompt,
            }
        ]

        # -----------------------------------------------------
        # Add previous conversation history
        # -----------------------------------------------------

        for item in history:

            role = item.get("role")
            content = item.get("content", "")

            if role not in {
                "user",
                "assistant",
                "tool",
            }:
                continue

            if not content:
                continue

            history_message = {
                "role": role,
                "content": content,
            }

            # Preserve tool name if available
            if role == "tool" and item.get("name"):
                history_message["name"] = item["name"]

            messages.append(history_message)

        # -----------------------------------------------------
        # Add current user message
        # -----------------------------------------------------

        messages.append(
            {
                "role": "user",
                "content": message.strip(),
            }
        )

        # -----------------------------------------------------
        # Ask the REAL LLM
        # -----------------------------------------------------

        try:

            response = self.llm.chat(messages)

        except Exception as exc:

            print(
                f"[ROUTER LLM ERROR] {exc}"
            )

            return "unknown"

        # -----------------------------------------------------
        # Clean LLM response
        # -----------------------------------------------------

        intent = self._normalize_intent(
            response
        )

        return intent

    # =========================================================
    # NORMALIZE INTENT
    # =========================================================

    def _normalize_intent(
        self,
        response: str,
    ) -> str:
        """
        Clean and validate the LLM response.
        """

        if not response:
            return "unknown"

        intent = response.strip().lower()

        # Remove common formatting
        intent = (
            intent
            .replace('"', "")
            .replace("'", "")
            .replace("`", "")
            .strip()
        )

        # Exact match
        if intent in self.VALID_INTENTS:
            return intent

        # -----------------------------------------------------
        # Handle responses such as:
        #
        # "The intent is check_availability"
        # -----------------------------------------------------

        for valid_intent in self.VALID_INTENTS:

            if valid_intent in intent:
                return valid_intent

        return "unknown"

    # =========================================================
    # ROUTE
    # =========================================================

    def route(
        self,
        message: str,
        history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Classify the message and return routing information.
        """

        intent = self.classify(
            message=message,
            history=history,
        )

        return {
            "success": True,
            "intent": intent,
            "message": message,
        }
