from typing import Optional, Dict, Any
from langchain_core.tools import tool

from tools.backend_client import HotelBackendClient
from tools.pricing_tool import calculate_total_price
from rag.rag_service import HotelRAG


# Initialize Backend Client
backend = HotelBackendClient()

# Singleton for RAG Service
_rag_instance = None


def get_rag_service() -> HotelRAG:
    global _rag_instance

    if _rag_instance is None:
        _rag_instance = HotelRAG()

    return _rag_instance


# ==========================================
# 1. RESERVATION & AVAILABILITY TOOLS
# ==========================================

@tool
def check_availability(
    check_in: str,
    check_out: str,
    guests: int,
    room_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Check room availability in the hotel for specific dates and guest count."""

    if not check_in or not check_out or guests is None or int(guests) <= 0:
        return {
            "success": False,
            "error": "check_in, check_out, and valid guests count are required.",
        }

    try:
        rooms = backend.get_available_rooms(
            check_in=check_in,
            check_out=check_out,
            guests=int(guests),
            room_type=room_type,
        )

        if not isinstance(rooms, dict):
            return {
                "success": False,
                "error": "Invalid response from backend.",
            }

        if not rooms.get("success"):
            return {
                "success": False,
                "error": rooms.get("error")
                or rooms.get("message")
                or "Backend request failed.",
            }

        # BackendClient puts the returned room list inside "data"
        rooms_list = rooms.get("data", [])

        if not isinstance(rooms_list, list):
            rooms_list = []

        return {
            "success": True,
            "available": len(rooms_list) > 0,
            "rooms": rooms_list,
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


# ==========================================
# 2. CUSTOMER TOOLS
# ==========================================

@tool
def find_customer(
    email: Optional[str] = None,
    phone: Optional[str] = None,
) -> Dict[str, Any]:
    """Search for an existing customer by email or phone number."""

    try:
        if email:
            res = backend.find_customer_by_email(email)

            if res:
                return {
                    "success": True,
                    "found": True,
                    "customer": res,
                }

        if phone:
            res = backend.find_customer_by_phone(phone)

            if res:
                return {
                    "success": True,
                    "found": True,
                    "customer": res,
                }

        return {
            "success": True,
            "found": False,
            "customer": None,
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@tool
def create_customer(
    name: str,
    email: str,
    phone: str,
) -> Dict[str, Any]:
    """Create a new customer profile with name, email, and phone."""

    try:
        customer = backend.create_customer(
            name,
            email,
            phone,
        )

        if isinstance(customer, dict) and (
            customer.get("success") is False
            or customer.get("status_code", 200) >= 400
            or customer.get("statusCode", 200) >= 400
        ):
            return {
                "success": False,
                "error": customer.get("error") or customer.get("message") or "Failed to create customer.",
            }

        return {
            "success": True,
            "customer": customer,
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


# ==========================================
# 3. RESERVATION TOOL
# ==========================================

@tool
def create_reservation(
    room_id: str,
    customer_id: str,
    check_in: str,
    check_out: str,
) -> Dict[str, Any]:
    """Book a hotel room for a customer using room_id and customer_id."""

    try:
        res = backend.create_reservation(
            room_id,
            customer_id,
            check_in,
            check_out,
        )

        if isinstance(res, dict) and (
            res.get("success") is False
            or res.get("status_code", 200) >= 400
            or res.get("statusCode", 200) >= 400
        ):
            return {
                "success": False,
                "error": res.get("error") or res.get("message") or "Failed to create reservation.",
            }

        return {
            "success": True,
            "reservation": res,
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


# ==========================================
# 4. CANCELLATION TOOL
# ==========================================

@tool
def cancel_reservation(
    reservation_id: str,
) -> Dict[str, Any]:
    """Cancel an existing reservation using the reservation_id."""

    try:
        res = backend.cancel_reservation(reservation_id)

        if isinstance(res, dict) and (
            res.get("success") is False
            or res.get("status_code", 200) >= 400
            or res.get("statusCode", 200) >= 400
        ):
            return {
                "success": False,
                "error": res.get("error") or res.get("message") or "Failed to cancel reservation.",
            }

        return {
            "success": True,
            "reservation": res,
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


# ==========================================
# 5. SALES & PRICING TOOL
# ==========================================

@tool
def calculate_price(
    price_per_night: float,
    check_in: str,
    check_out: str,
    guests: int,
) -> Dict[str, Any]:
    """Calculate total price for a stay given night rate, dates, and guest count."""

    return calculate_total_price.func(
        price_per_night,
        check_in,
        check_out,
        guests,
    )


# ==========================================
# 6. COMPLAINT TOOL
# ==========================================

@tool
def submit_complaint(
    customer_id: str,
    category: str,
    description: str,
    reservation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Submit a customer complaint with a category and description."""

    data = {
        "customerId": customer_id,
        "category": category,
        "description": description,
    }

    if reservation_id:
        data["reservationId"] = reservation_id

    try:
        res = backend.create_complaint(data)

        if isinstance(res, dict) and (
            res.get("success") is False
            or res.get("status_code", 200) >= 400
            or res.get("statusCode", 200) >= 400
        ):
            return {
                "success": False,
                "error": res.get("error") or res.get("message") or "Failed to submit complaint.",
            }

        return {
            "success": True,
            "complaint": res,
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


# ==========================================
# 7. GENERAL HOTEL INFO (RAG TOOL)
# ==========================================

@tool
def hotel_info_search(
    query: str,
) -> Dict[str, Any]:
    """Search knowledge base for general hotel info, policies, and facilities."""

    try:
        if not query or not query.strip():
            return {
                "success": True,
                "results": [],
            }

        rag = get_rag_service()
        results = rag.search(query.strip())

        return {
            "success": True,
            "results": results,
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }