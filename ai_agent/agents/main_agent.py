import json
import re
from typing import Any, Dict, List, Optional

from llm.llm_service import LLMService
from agents.router_agent import RouterAgent
import tools.hotel_tools as hotel_tools


class MainAgent:
    """
    Main orchestration layer for the hotel AI assistant.

    Responsibilities:
    - Receive user messages.
    - Maintain conversation/session state.
    - Use RouterAgent for intent classification.
    - Ask the LLM whether a tool is required.
    - Execute hotel tools.
    - Generate the final natural-language response.

    Important:
    - Backend is the source of truth for rooms, availability,
      prices, customers, reservations, and cancellations.
    - RAG is used only for hotel information.
    """

    def __init__(
        self,
        llm: Optional[LLMService] = None,
        router: Optional[RouterAgent] = None,
    ):
        self.llm = llm or LLMService()
        self.router = router or RouterAgent(llm=self.llm)

        self.messages: List[Dict[str, Any]] = []

        self.conversation_state = self._empty_state()

        self.system_prompt = """
You are a professional hotel reservation assistant.

You help customers with:
1. Checking room availability
2. Hotel information
3. Finding customers
4. Creating customers
5. Calculating prices
6. Creating reservations
7. Cancelling reservations
8. Handling complaints

IMPORTANT RULES:

- Understand natural language in Arabic and English.
- Use conversation history and current booking state.
- Backend data is the source of truth for:
  - room availability
  - room IDs
  - room numbers
  - room prices
  - customers
  - reservations
  - cancellation
- RAG is the source of truth only for general hotel information,
  facilities, services, restaurants, offers, FAQs, and hotel policies.
- NEVER invent room IDs, room numbers, prices, availability,
  customer IDs, or reservation IDs.
- If required information is missing, ask the user for it.
- Do not expose tool names.
- Do not expose raw JSON.
- Do not expose API implementation details.
- Respond naturally and politely.
- Use the real result returned by tools.
"""

    # =========================================================
    # STATE
    # =========================================================

    def _empty_state(self) -> Dict[str, Any]:
        return {
            "check_in": None,
            "check_out": None,
            "guests": None,

            "room_type": None,
            "room_number": None,
            "room_id": None,
            "price_per_night": None,

            "customer_id": None,
            "name": None,
            "email": None,
            "phone": None,

            "reservation_id": None,

            "available_rooms": [],
        }

    # =========================================================
    # TOOLS
    # =========================================================

    def get_tools(self) -> List[Dict[str, Any]]:
        """
        OpenAI-style tool schemas.

        The actual execution is handled by execute_tool().
        """

        return [
            # -------------------------------------------------
            # CHECK AVAILABILITY
            # -------------------------------------------------

            {
                "type": "function",
                "function": {
                    "name": "check_availability",
                    "description": (
                        "Check available hotel rooms for "
                        "specific dates and number of guests."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "check_in": {
                                "type": "string",
                                "description": (
                                    "Check-in date in "
                                    "YYYY-MM-DD format."
                                ),
                            },
                            "check_out": {
                                "type": "string",
                                "description": (
                                    "Check-out date in "
                                    "YYYY-MM-DD format."
                                ),
                            },
                            "guests": {
                                "type": "integer",
                                "description": (
                                    "Number of guests."
                                ),
                            },
                            "room_type": {
                                "type": "string",
                                "description": (
                                    "Optional room type such as "
                                    "Single, Double, Twin, Suite, "
                                    "or Family."
                                ),
                            },
                        },
                        "required": [
                            "check_in",
                            "check_out",
                            "guests",
                        ],
                    },
                },
            },

            # -------------------------------------------------
            # HOTEL INFORMATION
            # -------------------------------------------------

            {
                "type": "function",
                "function": {
                    "name": "hotel_information",
                    "description": (
                        "Search hotel information using "
                        "the hotel knowledge base."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": (
                                    "The hotel information query."
                                ),
                            }
                        },
                        "required": ["query"],
                    },
                },
            },

            # -------------------------------------------------
            # FIND CUSTOMER
            # -------------------------------------------------

            {
                "type": "function",
                "function": {
                    "name": "find_customer",
                    "description": (
                        "Find an existing customer using "
                        "email or phone."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "email": {
                                "type": "string",
                                "description": (
                                    "Customer email."
                                ),
                            },
                            "phone": {
                                "type": "string",
                                "description": (
                                    "Customer phone."
                                ),
                            },
                        },
                    },
                },
            },

            # -------------------------------------------------
            # CREATE CUSTOMER
            # -------------------------------------------------

            {
                "type": "function",
                "function": {
                    "name": "create_customer",
                    "description": (
                        "Create a new hotel customer."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                            },
                            "email": {
                                "type": "string",
                            },
                            "phone": {
                                "type": "string",
                            },
                        },
                        "required": [
                            "name",
                            "email",
                            "phone",
                        ],
                    },
                },
            },

            # -------------------------------------------------
            # SELECT ROOM
            # -------------------------------------------------

            {
                "type": "function",
                "function": {
                    "name": "select_room",
                    "description": (
                        "Select a specific room by its room number "
                        "from the list of available rooms."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "room_number": {
                                "type": "integer",
                                "description": (
                                    "The room number selected by the user (e.g. 101, 106, 206)."
                                ),
                            },
                        },
                        "required": ["room_number"],
                    },
                },
            },

            # -------------------------------------------------
            # CALCULATE PRICE
            # -------------------------------------------------

            {
                "type": "function",
                "function": {
                    "name": "calculate_price",
                    "description": (
                        "Calculate the reservation price "
                        "using the room price or room number."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "price_per_night": {
                                "type": "number",
                                "description": (
                                    "Optional room price per night."
                                ),
                            },
                            "room_number": {
                                "type": "integer",
                                "description": (
                                    "Optional room number to calculate price for."
                                ),
                            },
                            "check_in": {
                                "type": "string",
                                "description": "Check-in date (YYYY-MM-DD).",
                            },
                            "check_out": {
                                "type": "string",
                                "description": "Check-out date (YYYY-MM-DD).",
                            },
                            "guests": {
                                "type": "integer",
                                "description": "Number of guests.",
                            },
                        },
                        "required": [
                            "check_in",
                            "check_out",
                            "guests",
                        ],
                    },
                },
            },

            # -------------------------------------------------
            # CREATE RESERVATION
            # -------------------------------------------------

            {
                "type": "function",
                "function": {
                    "name": "create_reservation",
                    "description": (
                        "Create a reservation using a real "
                        "backend room ID and customer ID."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "room_id": {
                                "type": "string",
                                "description": (
                                    "Real room ID returned "
                                    "by backend."
                                ),
                            },
                            "customer_id": {
                                "type": "string",
                                "description": (
                                    "Real customer ID."
                                ),
                            },
                            "check_in": {
                                "type": "string",
                            },
                            "check_out": {
                                "type": "string",
                            },
                            "room_number": {
                                "type": "integer",
                                "description": (
                                    "Optional room number "
                                    "selected by the user."
                                ),
                            },
                        },
                        "required": [
                            "room_id",
                            "customer_id",
                            "check_in",
                            "check_out",
                        ],
                    },
                },
            },

            # -------------------------------------------------
            # CANCEL RESERVATION
            # -------------------------------------------------

            {
                "type": "function",
                "function": {
                    "name": "cancel_reservation",
                    "description": (
                        "Cancel an existing reservation."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "reservation_id": {
                                "type": "string",
                            }
                        },
                        "required": [
                            "reservation_id"
                        ],
                    },
                },
            },

            # -------------------------------------------------
            # SUBMIT COMPLAINT
            # -------------------------------------------------

            {
                "type": "function",
                "function": {
                    "name": "submit_complaint",
                    "description": (
                        "Submit a hotel customer complaint."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "customer_id": {
                                "type": "string",
                            },
                            "category": {
                                "type": "string",
                            },
                            "description": {
                                "type": "string",
                            },
                            "reservation_id": {
                                "type": "string",
                            },
                        },
                        "required": [
                            "customer_id",
                            "category",
                            "description",
                        ],
                    },
                },
            },
        ]

    # =========================================================
    # ROOM SELECTION
    # =========================================================

    def _select_room_from_state(
        self,
        room_number: Optional[Any] = None,
    ) -> bool:
        """
        Select a room ONLY from rooms returned by the backend.

        This prevents the LLM from inventing:
        - room IDs
        - room numbers
        - prices
        """

        rooms = self.conversation_state.get(
            "available_rooms",
            []
        )

        if not rooms:
            return False

        if room_number is None:
            return False

        target = str(room_number).strip()

        for room in rooms:

            if not isinstance(room, dict):
                continue

            possible_numbers = [
                room.get("roomNumber"),
                room.get("room_number"),
                room.get("number"),
            ]

            for number in possible_numbers:

                if number is None:
                    continue

                if str(number).strip() == target:

                    room_id = (
                        room.get("id")
                        or room.get("roomId")
                        or room.get("room_id")
                    )

                    price = (
                        room.get("pricePerNight")
                        or room.get("price_per_night")
                        or room.get("price")
                    )

                    self.conversation_state[
                        "room_number"
                    ] = number

                    self.conversation_state[
                        "room_id"
                    ] = room_id

                    self.conversation_state[
                        "price_per_night"
                    ] = price

                    return bool(room_id)

        return False

    # =========================================================
    # TOOL EXECUTION
    # =========================================================

    def execute_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
    ) -> Dict[str, Any]:

        try:

            # =================================================
            # AVAILABILITY
            # =================================================

            if tool_name == "check_availability":

                result = hotel_tools.check_availability.func(
                    check_in=arguments.get(
                        "check_in"
                    ),
                    check_out=arguments.get(
                        "check_out"
                    ),
                    guests=arguments.get(
                        "guests"
                    ),
                    room_type=arguments.get(
                        "room_type"
                    ),
                )

                if result.get("success"):

                    self.conversation_state[
                        "check_in"
                    ] = arguments.get("check_in")

                    self.conversation_state[
                        "check_out"
                    ] = arguments.get("check_out")

                    self.conversation_state[
                        "guests"
                    ] = arguments.get("guests")

                    self.conversation_state[
                        "room_type"
                    ] = arguments.get("room_type")

                    self.conversation_state[
                        "available_rooms"
                    ] = result.get("rooms", [])

                    # A new availability search means
                    # previous room selection is no longer valid.
                    self.conversation_state[
                        "room_number"
                    ] = None

                    self.conversation_state[
                        "room_id"
                    ] = None

                    self.conversation_state[
                        "price_per_night"
                    ] = None

                return result

            # =================================================
            # HOTEL INFORMATION
            # =================================================

            if tool_name == "hotel_information":

                return hotel_tools.hotel_info_search.func(
                    query=arguments.get(
                        "query",
                        ""
                    )
                )

            # =================================================
            # FIND CUSTOMER
            # =================================================

            if tool_name == "find_customer":

                result = hotel_tools.find_customer.func(
                    email=arguments.get(
                        "email"
                    ),
                    phone=arguments.get(
                        "phone"
                    ),
                )

                if (
                    result.get("success")
                    and result.get("found")
                ):

                    customer = (
                        result.get("customer")
                        or {}
                    )

                    self.conversation_state[
                        "customer_id"
                    ] = (
                        customer.get("id")
                        or customer.get(
                            "customerId"
                        )
                        or customer.get(
                            "customer_id"
                        )
                    )

                    self.conversation_state[
                        "name"
                    ] = customer.get("name")

                    self.conversation_state[
                        "email"
                    ] = customer.get("email")

                    self.conversation_state[
                        "phone"
                    ] = customer.get("phone")

                return result

            # =================================================
            # CREATE CUSTOMER
            # =================================================

            if tool_name == "create_customer":

                name = arguments.get("name")
                email = arguments.get("email")
                phone = arguments.get("phone")

                if not name or not email or not phone:

                    return {
                        "success": False,
                        "error": (
                            "name, email, and phone "
                            "are required."
                        ),
                    }

                result = hotel_tools.create_customer.func(
                    name=name,
                    email=email,
                    phone=phone,
                )

                if result.get("success"):

                    customer = (
                        result.get("customer")
                        or {}
                    )

                    self.conversation_state[
                        "customer_id"
                    ] = (
                        customer.get("id")
                        or customer.get(
                            "customerId"
                        )
                        or customer.get(
                            "customer_id"
                        )
                    )

                    self.conversation_state[
                        "name"
                    ] = (
                        customer.get("name")
                        or name
                    )

                    self.conversation_state[
                        "email"
                    ] = (
                        customer.get("email")
                        or email
                    )

                    self.conversation_state[
                        "phone"
                    ] = (
                        customer.get("phone")
                        or phone
                    )

                return result

            # =================================================
            # SELECT ROOM
            # =================================================

            if tool_name == "select_room":

                room_number = arguments.get("room_number")
                if room_number is None:
                    return {
                        "success": False,
                        "error": "room_number is required to select a room.",
                    }

                selected = self._select_room_from_state(room_number)
                if not selected:
                    return {
                        "success": False,
                        "error": (
                            f"Room {room_number} was not found in the available rooms."
                        ),
                    }

                return {
                    "success": True,
                    "message": f"Room {room_number} selected successfully.",
                    "room_number": self.conversation_state.get("room_number"),
                    "room_id": self.conversation_state.get("room_id"),
                    "price_per_night": self.conversation_state.get("price_per_night"),
                }

            # =================================================
            # CALCULATE PRICE
            # =================================================

            if tool_name == "calculate_price":

                # 1. If room_number is passed, try to select that room
                room_number = arguments.get("room_number")
                if room_number is not None and not self.conversation_state.get("price_per_night"):
                    self._select_room_from_state(room_number)

                # 2. Check backend price from state
                backend_price = self.conversation_state.get("price_per_night")

                # 3. If price is still None, check if arguments provide price_per_night
                arg_price = arguments.get("price_per_night")
                available_rooms = self.conversation_state.get("available_rooms", [])

                if backend_price is None and arg_price is not None:
                    try:
                        arg_float = float(arg_price)
                        matched_room = None
                        for rm in available_rooms:
                            p = rm.get("pricePerNight") or rm.get("price_per_night") or rm.get("price")
                            if p is not None and abs(float(p) - arg_float) < 0.01:
                                matched_room = rm
                                break

                        if matched_room:
                            backend_price = arg_float
                            if not self.conversation_state.get("room_id"):
                                self._select_room_from_state(
                                    matched_room.get("roomNumber") or matched_room.get("room_number")
                                )
                        elif arg_float > 0:
                            backend_price = arg_float
                    except (ValueError, TypeError):
                        pass

                # 4. If still None and available_rooms has rooms, use the first matching or single available room
                if backend_price is None and available_rooms:
                    first_room = available_rooms[0]
                    p = first_room.get("pricePerNight") or first_room.get("price_per_night") or first_room.get("price")
                    if p is not None:
                        backend_price = float(p)
                        if not self.conversation_state.get("room_id"):
                            self._select_room_from_state(
                                first_room.get("roomNumber") or first_room.get("room_number")
                            )

                if backend_price is None:
                    return {
                        "success": False,
                        "error": (
                            "No valid room price is "
                            "available yet. Check room "
                            "availability first."
                        ),
                    }

                check_in = (
                    arguments.get("check_in")
                    or self.conversation_state.get("check_in")
                )

                check_out = (
                    arguments.get("check_out")
                    or self.conversation_state.get("check_out")
                )

                guests = (
                    arguments.get("guests")
                    or self.conversation_state.get("guests")
                )

                if (
                    not check_in
                    or not check_out
                    or not guests
                ):
                    return {
                        "success": False,
                        "error": (
                            "Check-in, check-out, "
                            "and guests are required "
                            "before calculating price."
                        ),
                    }

                # Update conversation state with latest dates and price
                self.conversation_state["price_per_night"] = backend_price
                self.conversation_state["check_in"] = check_in
                self.conversation_state["check_out"] = check_out
                self.conversation_state["guests"] = guests

                return hotel_tools.calculate_price.func(
                    price_per_night=float(backend_price),
                    check_in=check_in,
                    check_out=check_out,
                    guests=int(guests),
                )

            # =================================================
            # CREATE RESERVATION
            # =================================================

            if tool_name == "create_reservation":

                room_number = arguments.get("room_number")
                if room_number is not None:
                    self._select_room_from_state(room_number)

                room_id = arguments.get("room_id")
                available_rooms = self.conversation_state.get("available_rooms", [])

                # If room_id was passed, check if it's in available_rooms
                if room_id:
                    for rm in available_rooms:
                        rid = rm.get("id") or rm.get("roomId") or rm.get("room_id")
                        if str(rid) == str(room_id):
                            self.conversation_state["room_id"] = rid
                            self.conversation_state["room_number"] = (
                                rm.get("roomNumber") or rm.get("room_number")
                            )
                            self.conversation_state["price_per_night"] = (
                                rm.get("pricePerNight") or rm.get("price_per_night")
                            )
                            break

                # Fallback to room_id from state
                if not room_id:
                    room_id = self.conversation_state.get("room_id")

                # If still no room_id, but room_number is in state, select it
                if not room_id and self.conversation_state.get("room_number") is not None:
                    self._select_room_from_state(self.conversation_state.get("room_number"))
                    room_id = self.conversation_state.get("room_id")

                # If still no room_id and available_rooms has only 1 room, auto-select it
                if not room_id and len(available_rooms) == 1:
                    first_room = available_rooms[0]
                    self._select_room_from_state(
                        first_room.get("roomNumber") or first_room.get("room_number")
                    )
                    room_id = self.conversation_state.get("room_id")

                customer_id = (
                    self.conversation_state.get("customer_id")
                    or arguments.get("customer_id")
                )

                check_in = (
                    self.conversation_state.get("check_in")
                    or arguments.get("check_in")
                )

                check_out = (
                    self.conversation_state.get("check_out")
                    or arguments.get("check_out")
                )

                if not room_id:
                    return {
                        "success": False,
                        "error": (
                            "No valid room has been "
                            "selected. Please choose "
                            "a room from the available rooms."
                        ),
                    }

                if not customer_id:
                    return {
                        "success": False,
                        "error": (
                            "A valid customer is required "
                            "before creating the reservation."
                        ),
                    }

                if not check_in or not check_out:
                    return {
                        "success": False,
                        "error": (
                            "Check-in and check-out "
                            "dates are required."
                        ),
                    }

                result = (
                    hotel_tools.create_reservation.func(
                        room_id=room_id,
                        customer_id=customer_id,
                        check_in=check_in,
                        check_out=check_out,
                    )
                )

                if result.get("success"):

                    reservation = (
                        result.get(
                            "reservation"
                        )
                        or {}
                    )

                    self.conversation_state[
                        "reservation_id"
                    ] = (
                        reservation.get("id")
                        or reservation.get(
                            "reservationId"
                        )
                        or reservation.get(
                            "reservation_id"
                        )
                    )

                return result

            # =================================================
            # CANCEL RESERVATION
            # =================================================

            if tool_name == "cancel_reservation":

                reservation_id = (
                    arguments.get(
                        "reservation_id"
                    )
                    or self.conversation_state.get(
                        "reservation_id"
                    )
                )

                if not reservation_id:

                    return {
                        "success": False,
                        "error": (
                            "reservation_id is required."
                        ),
                    }

                result = (
                    hotel_tools.cancel_reservation.func(
                        reservation_id=reservation_id
                    )
                )

                if result.get("success"):

                    self.conversation_state[
                        "reservation_id"
                    ] = reservation_id

                return result

            # =================================================
            # COMPLAINT
            # =================================================

            if tool_name == "submit_complaint":

                customer_id = (
                    arguments.get(
                        "customer_id"
                    )
                    or self.conversation_state.get(
                        "customer_id"
                    )
                )

                category = arguments.get(
                    "category"
                )

                description = arguments.get(
                    "description"
                )

                if not customer_id:

                    return {
                        "success": False,
                        "error": (
                            "customer_id is required."
                        ),
                    }

                if not category or not description:

                    return {
                        "success": False,
                        "error": (
                            "category and description "
                            "are required."
                        ),
                    }

                return hotel_tools.submit_complaint.func(
                    customer_id=customer_id,
                    category=category,
                    description=description,
                    reservation_id=arguments.get(
                        "reservation_id"
                    ),
                )

            # =================================================
            # UNKNOWN TOOL
            # =================================================

            return {
                "success": False,
                "error": (
                    f"Unknown tool: {tool_name}"
                ),
            }

        except Exception as e:

            return {
                "success": False,
                "error": str(e),
            }

    # =========================================================
    # MAIN RUN LOOP
    # =========================================================

    def run(
        self,
        user_input: str,
    ) -> str:

        if not user_input or not user_input.strip():

            return "Please enter a message."

        # Auto-detect if user mentioned a room number (e.g. 'room number 106', 'الغرفة 106')
        room_match = re.search(
            r'(?:room\s*(?:number|no\.?)?|الغرفة\s*(?:رقم)?)\s*[:#]?\s*(\d+)',
            user_input,
            re.IGNORECASE,
        )
        if room_match:
            try:
                extracted_room_num = int(room_match.group(1))
                self._select_room_from_state(extracted_room_num)
            except Exception:
                pass

        # -----------------------------------------------------
        # Detect intent
        # -----------------------------------------------------

        intent = self.router.classify(
            user_input,
            history=self.messages,
        )

        # -----------------------------------------------------
        # Save user message
        # -----------------------------------------------------

        self.messages.append(
            {
                "role": "user",
                "content": user_input,
            }
        )

        # -----------------------------------------------------
        # Build conversation payload
        # -----------------------------------------------------

        conversation_payload = [
            {
                "role": "system",
                "content": (
                    self.system_prompt
                    + "\n\nDetected intent: "
                    + str(intent)
                    + "\n\nCurrent booking state:\n"
                    + json.dumps(
                        self.conversation_state,
                        ensure_ascii=False,
                    )
                ),
            }
        ]

        conversation_payload.extend(
            self.messages
        )

        # -----------------------------------------------------
        # Tool loop
        # -----------------------------------------------------

        max_iterations = 10

        for _ in range(max_iterations):

            response = self.llm.chat_completion(
                messages=conversation_payload,
                tools=self.get_tools(),
            )

            if response is None:

                return (
                    "Sorry, I could not process "
                    "your request."
                )

            # -------------------------------------------------
            # Normalize LLM response
            # -------------------------------------------------

            if isinstance(response, dict):

                content = response.get(
                    "content"
                )

                tool_calls = response.get(
                    "tool_calls",
                    []
                )

            else:

                content = getattr(
                    response,
                    "content",
                    None
                )

                tool_calls = getattr(
                    response,
                    "tool_calls",
                    []
                )

            # -------------------------------------------------
            # No tool call
            # -------------------------------------------------

            if not tool_calls:

                final_content = content

                if isinstance(
                    final_content,
                    list
                ):

                    final_content = " ".join(
                        str(item)
                        for item in final_content
                    )

                if not final_content:

                    final_content = (
                        "Sorry, I could not "
                        "generate a response."
                    )

                self.messages.append(
                    {
                        "role": "assistant",
                        "content": final_content,
                    }
                )

                return str(
                    final_content
                )

            # -------------------------------------------------
            # Add assistant tool-call message
            # -------------------------------------------------

            assistant_message = {
                "role": "assistant",
                "content": content or "",
                "tool_calls": tool_calls,
            }

            conversation_payload.append(
                assistant_message
            )

            # -------------------------------------------------
            # Execute tools
            # -------------------------------------------------

            for tool_call in tool_calls:

                # ---------------------------------------------
                # Dictionary tool call
                # ---------------------------------------------

                if isinstance(
                    tool_call,
                    dict
                ):

                    function_data = (
                        tool_call.get(
                            "function",
                            {}
                        )
                    )

                    tool_name = (
                        function_data.get(
                            "name"
                        )
                    )

                    raw_arguments = (
                        function_data.get(
                            "arguments",
                            {}
                        )
                    )

                    tool_call_id = (
                        tool_call.get("id")
                    )

                # ---------------------------------------------
                # Object tool call
                # ---------------------------------------------

                else:

                    function_data = getattr(
                        tool_call,
                        "function",
                        None
                    )

                    if function_data:

                        tool_name = getattr(
                            function_data,
                            "name",
                            None
                        )

                        raw_arguments = getattr(
                            function_data,
                            "arguments",
                            {}
                        )

                    else:

                        tool_name = getattr(
                            tool_call,
                            "name",
                            None
                        )

                        raw_arguments = getattr(
                            tool_call,
                            "arguments",
                            {}
                        )

                    tool_call_id = getattr(
                        tool_call,
                        "id",
                        None
                    )

                # ---------------------------------------------
                # Parse arguments
                # ---------------------------------------------

                if isinstance(
                    raw_arguments,
                    str
                ):

                    try:

                        arguments = json.loads(
                            raw_arguments
                        )

                    except json.JSONDecodeError:

                        arguments = {}

                elif isinstance(
                    raw_arguments,
                    dict
                ):

                    arguments = raw_arguments

                else:

                    arguments = {}

                # ---------------------------------------------
                # Execute tool
                # ---------------------------------------------

                result = self.execute_tool(
                    tool_name,
                    arguments,
                )

                # ---------------------------------------------
                # Add tool result
                # ---------------------------------------------

                tool_message = {
                    "role": "tool",
                    "name": tool_name,
                    "content": json.dumps(
                        result,
                        ensure_ascii=False,
                    ),
                }

                if tool_call_id:

                    tool_message[
                        "tool_call_id"
                    ] = tool_call_id

                conversation_payload.append(
                    tool_message
                )

                # Keep system prompt's booking state updated with latest state
                conversation_payload[0]["content"] = (
                    self.system_prompt
                    + "\n\nDetected intent: "
                    + str(intent)
                    + "\n\nCurrent booking state:\n"
                    + json.dumps(
                        self.conversation_state,
                        ensure_ascii=False,
                    )
                )

        return (
            "I couldn't complete the request "
            "within the allowed processing steps."
        )

    # =========================================================
    # API / FASTAPI ENTRY POINT
    # =========================================================

    def handle_message(
        self,
        user_input: str,
    ) -> Dict[str, Any]:

        try:

            response = self.run(
                user_input
            )

            return {
                "success": True,
                "message": response,
                "state": self.get_state(),
            }

        except Exception as e:

            return {
                "success": False,
                "message": (
                    "Sorry, something went wrong "
                    "with the AI Agent."
                ),
                "error": str(e),
            }

    # =========================================================
    # GET STATE
    # =========================================================

    def get_state(
        self,
    ) -> Dict[str, Any]:

        return self.conversation_state

    # =========================================================
    # RESET
    # =========================================================

    def reset(self):

        self.messages = []

        self.conversation_state = (
            self._empty_state()
        )

