import requests
import re
from datetime import datetime
from typing import Optional, Dict, Any


class HotelBackendClient:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url.rstrip("/")

    def _parse_response(self, response: requests.Response) -> Dict[str, Any]:
        """دالة معالجة الاستجابة لمنع الـ Exception وقراءة الرسائل بدقة"""
        if not response.text or not response.text.strip():
            return {"success": response.ok, "status_code": response.status_code}
        
        try:
            parsed = response.json()
            if isinstance(parsed, dict):
                parsed["status_code"] = response.status_code
                parsed["success"] = response.ok
                return parsed
            return {"success": response.ok, "data": parsed, "status_code": response.status_code}
        except ValueError:
            return {
                "success": response.ok,
                "status_code": response.status_code,
                "message": response.text
            }

    def _make_request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        """دالة موحدة للطلبات مع تجربة /api تلقائياً عند 404"""
        url = f"{self.base_url}{path}"
        try:
            response = requests.request(method, url, **kwargs)

            if response.status_code == 404 and not path.startswith("/api"):
                alt_url = f"{self.base_url}/api{path}"
                alt_response = requests.request(method, alt_url, **kwargs)
                if alt_response.status_code != 404:
                    response = alt_response

            print(f"\n[BACKEND DEBUG] {method} -> {response.url}")
            print(f"[STATUS CODE]   {response.status_code}")
            print(f"[RESPONSE TEXT] {response.text}\n")

            return self._parse_response(response)

        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": f"Connection error to backend server: {str(e)}"
            }

    def _format_date(self, date_str: str) -> str:
        """تحويل التاريخ لصيغة YYYY-MM-DD لتمرير شرط @IsDateString"""
        if not date_str:
            return date_str
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            return date_str

    # ==========================================
    # Get Available Rooms
    # ==========================================
    def get_available_rooms(
        self,
        check_in: str,
        check_out: str,
        guests: int,
        room_type: Optional[str] = None
    ) -> Dict[str, Any]:
        params = {
            "checkIn": self._format_date(check_in),
            "checkOut": self._format_date(check_out),
            "guests": guests,
        }

        if room_type:
            normalized = self._normalize_room_type(room_type)
            params["roomType"] = normalized if normalized else room_type

        return self._make_request("GET", "/rooms/available", params=params, timeout=10)

    def _normalize_room_type(self, room_type: str) -> Optional[str]:
        if not room_type:
            return None
        room_type = room_type.strip().lower()
        room_type = re.sub(r"\s*room\s*$", "", room_type).strip()
        mapping = {
            "single": "Single",
            "double": "Double",
            "twin": "Twin",
            "suite": "Suite",
            "family": "Family",
        }
        return mapping.get(room_type)

    # ==========================================
    # Get All Rooms
    # ==========================================
    def get_rooms(self) -> Dict[str, Any]:
        return self._make_request("GET", "/rooms", timeout=10)

    # ==========================================
    # Get Customers
    # ==========================================
    def get_customers(self) -> Dict[str, Any]:
        return self._make_request("GET", "/customers", timeout=10)

    # ==========================================
    # Find Customer By Email
    # ==========================================
    def find_customer_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        res = self._make_request("GET", "/customers/by-email", params={"email": email}, timeout=10)
        if res.get("status_code") == 404:
            return None
        return res

    # ==========================================
    # Find Customer By Phone
    # ==========================================
    def find_customer_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        res = self._make_request("GET", "/customers/by-phone", params={"phone": phone}, timeout=10)
        if res.get("status_code") == 404:
            return None
        return res

    # ==========================================
    # Create Customer
    # ==========================================
    def create_customer(self, name: str, email: str, phone: str) -> Dict[str, Any]:
        data = {
            "name": name,
            "email": email,
            "phone": phone
        }
        return self._make_request("POST", "/customers", json=data, timeout=10)

    # ==========================================
    # Create Reservation
    # ==========================================
    def create_reservation(
        self,
        room_id: str,
        customer_id: str,
        check_in: str,
        check_out: str
    ) -> Dict[str, Any]:
        data = {
            "roomId": room_id,
            "customerId": customer_id,
            "checkIn": self._format_date(check_in),
            "checkOut": self._format_date(check_out)
        }
        return self._make_request("POST", "/reservations", json=data, timeout=10)

    # ==========================================
    # Get Reservation
    # ==========================================
    def get_reservation(self, reservation_id: str) -> Optional[Dict[str, Any]]:
        res = self._make_request("GET", f"/reservations/{reservation_id}", timeout=10)
        if res.get("status_code") == 404:
            return None
        return res

    # ==========================================
    # Cancel Reservation
    # ==========================================
    def cancel_reservation(self, reservation_id: str) -> Dict[str, Any]:
        return self._make_request("DELETE", f"/reservations/{reservation_id}", timeout=10)

    # ==========================================
    # Create Complaint
    # ==========================================
    def create_complaint(self, data: dict) -> Dict[str, Any]:
        return self._make_request("POST", "/complaints", json=data, timeout=10)