from datetime import date
from typing import Dict, Any
from langchain_core.tools import tool

@tool
def calculate_total_price(
    price_per_night: float,
    check_in: str,
    check_out: str,
    guests: int,
    compensation_discount: bool = False
) -> Dict[str, Any]:
    """
    Calculate the total reservation price including stay duration, group discounts, 
    and complaint compensation discounts for sales offers.
    
    Args:
        price_per_night: The base cost for one night.
        check_in: Check-in date in YYYY-MM-DD format.
        check_out: Check-out date in YYYY-MM-DD format.
        guests: Number of guests.
        compensation_discount: True if the customer holds a complaint compensation voucher.
    """
    try:
        price_per_night = float(price_per_night)
        guests = int(guests)
        check_in_date = date.fromisoformat(check_in.strip())
        check_out_date = date.fromisoformat(check_out.strip())
    except (ValueError, TypeError):
        return {
            "success": False,
            "error": "Invalid date format (use YYYY-MM-DD) or invalid numerical inputs."
        }

    # Validation Checks
    if check_out_date <= check_in_date:
        return {
            "success": False,
            "error": "Check-out date must be after check-in date."
        }

    if price_per_night < 0:
        return {
            "success": False,
            "error": "Price per night cannot be negative."
        }

    if guests <= 0:
        return {
            "success": False,
            "error": "Guests count must be greater than 0."
        }

    total_nights = (check_out_date - check_in_date).days
    base_total = price_per_night * total_nights

    # Determine Group Discount
    if guests >= 8:
        group_discount = 8
    elif guests >= 5:
        group_discount = 5
    else:
        group_discount = 0

    # Determine Compensation Discount
    comp_discount = 10 if compensation_discount else 0

    # Apply Best Discount or Stacked Strategy (Choosing maximum discount percentage)
    if comp_discount > 0 and group_discount > 0:
        discount_percentage = comp_discount + group_discount  # Stacked discount
        discount_type = "compensation_and_group"
    elif comp_discount > 0:
        discount_percentage = comp_discount
        discount_type = "complaint_compensation"
    else:
        discount_percentage = group_discount
        discount_type = "group" if group_discount > 0 else "none"

    discount_amount = (base_total * discount_percentage) / 100
    final_total = base_total - discount_amount

    return {
        "success": True,
        "total_nights": total_nights,
        "price_per_night": round(price_per_night, 2),
        "base_total": round(base_total, 2),
        "discount_percentage": discount_percentage,
        "discount_amount": round(discount_amount, 2),
        "final_total": round(final_total, 2),
        "discount_type": discount_type
    }