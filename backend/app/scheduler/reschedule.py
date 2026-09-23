from dataclasses import dataclass, field
from datetime import date
from typing import List


@dataclass
class SlotWithItemStatus:
    slot_id: int
    item_id: int
    slot_date: date
    item_status: str  # 'inbox', 'scheduled', 'done', 'skipped'


@dataclass
class RescheduleDecision:
    slots_to_delete: List[int] = field(default_factory=list)
    items_to_revert: List[int] = field(default_factory=list)


def evaluate_reschedule_job(
    current_date: date,
    slots: List[SlotWithItemStatus],
) -> RescheduleDecision:
    """
    Pure logic function for SPEC 1.6 reschedule job:
    Any schedule_slots row from a past date (slot_date < current_date) whose item
    is not 'done' → delete slot, item reverts to 'inbox'.
    """
    slots_to_delete = []
    items_to_revert = []

    for s in slots:
        if s.slot_date < current_date and s.item_status != "done":
            slots_to_delete.append(s.slot_id)
            if s.item_id not in items_to_revert:
                items_to_revert.append(s.item_id)

    return RescheduleDecision(
        slots_to_delete=slots_to_delete,
        items_to_revert=items_to_revert,
    )

