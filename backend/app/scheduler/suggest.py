from dataclasses import dataclass, field
from datetime import datetime, date, time, timezone
from typing import Optional, List, Dict, Tuple

from app.scheduler.types import (
    InboxItem,
    RoutineBlockItem,
    SchedulerPrefs,
)
from app.scheduler.algorithm import (
    time_to_minutes,
    minutes_to_time,
    parse_deep_hours,
    compute_urgency_score,
)


@dataclass
class SlotItemContext:
    id: int
    item_id: Optional[int]
    date: date
    start_time: time
    end_time: time
    item: Optional[InboxItem] = None
    is_done: bool = False


@dataclass
class NowSuggestion:
    context_type: str  # "routine" | "scheduled_slot" | "deep_work" | "free_gap" | "off_hours" | "clear"
    current_time: datetime
    reason: str
    item: Optional[InboxItem] = None
    slot: Optional[SlotItemContext] = None
    routine_block: Optional[RoutineBlockItem] = None
    free_minutes_remaining: Optional[int] = None
    effective_duration_min: Optional[int] = None


def _fmt12(t: time) -> str:
    """Format time in 12-hour AM/PM format (e.g. '9:00 AM', '2:30 PM')."""
    return t.strftime("%I:%M %p").lstrip("0")


def get_effective_duration(item: InboxItem, prefs: SchedulerPrefs) -> int:
    """Calculate effective duration considering learned multipliers."""
    cat = (item.category or "task").lower()
    topic = getattr(item, "topic_tag", None)
    multiplier = 1.0
    if topic and topic.lower() in prefs.category_duration_multiplier:
        multiplier = prefs.category_duration_multiplier[topic.lower()]
    elif cat in prefs.category_duration_multiplier:
        multiplier = prefs.category_duration_multiplier[cat]
    elif (item.category or "task") in prefs.category_duration_multiplier:
        multiplier = prefs.category_duration_multiplier[item.category or "task"]

    base_dur = item.est_duration_min or 30
    return max(5, int(round(base_dur * multiplier)))


def evaluate_now_suggestion(
    now: datetime,
    inbox_items: List[InboxItem],
    routine_blocks: List[RoutineBlockItem],
    today_slots: List[SlotItemContext],
    prefs: SchedulerPrefs,
) -> NowSuggestion:
    """
    Pure heuristic for 'What should I do now?' (SPEC 1.8 & 1.9 Step 8).
    Evaluates current temporal context:
    - In routine block -> Suggests focusing on routine / rest
    - In scheduled slot -> Suggests the active scheduled item
    - In deep work window -> Suggests top-ranked high-priority / deep item fitting window
    - In free gap -> Suggests best-fit inbox item for available time before next barrier
    - Off hours -> Suggests light task or rest
    - Empty inbox -> All clear
    """
    now_time = now.time()
    now_min = time_to_minutes(now_time)
    weekday = now.weekday()
    target_date = now.date()

    day_start_min = time_to_minutes(prefs.day_start)
    day_end_min = time_to_minutes(prefs.day_end)

    # 1. Case A: Currently inside a fixed routine block
    for block in routine_blocks:
        if block.day_of_week == weekday and block.fixed:
            b_start = time_to_minutes(block.start_time)
            b_end = time_to_minutes(block.end_time)
            if b_start <= now_min < b_end:
                rem = b_end - now_min
                label = block.label or "Routine Commitment"
                return NowSuggestion(
                    context_type="routine",
                    current_time=now,
                    reason=f"Routine block '{label}' in progress until {_fmt12(block.end_time)} ({rem}m remaining). Rest, recharge, or focus on this commitment.",
                    routine_block=block,
                    free_minutes_remaining=rem,
                )

    # 2. Case B: Currently inside an active scheduled slot
    for slot in today_slots:
        if slot.date == target_date:
            s_start = time_to_minutes(slot.start_time)
            s_end = time_to_minutes(slot.end_time)
            if s_start <= now_min < s_end and not slot.is_done:
                rem = s_end - now_min
                item_title = slot.item.raw_text if slot.item else "Scheduled Task"
                return NowSuggestion(
                    context_type="scheduled_slot",
                    current_time=now,
                    reason=f"Scheduled slot in progress until {_fmt12(slot.end_time)} ({rem}m remaining). Focus on '{item_title}'.",
                    item=slot.item,
                    slot=slot,
                    free_minutes_remaining=rem,
                    effective_duration_min=get_effective_duration(slot.item, prefs) if slot.item else rem,
                )

    # 3. Find the next barrier (upcoming routine block or scheduled slot or day_end)
    upcoming_barriers: List[Tuple[int, str]] = []
    for block in routine_blocks:
        if block.day_of_week == weekday and block.fixed:
            b_start = time_to_minutes(block.start_time)
            if b_start > now_min:
                upcoming_barriers.append((b_start, f"routine '{block.label or 'routine'}'"))

    for slot in today_slots:
        if slot.date == target_date and not slot.is_done:
            s_start = time_to_minutes(slot.start_time)
            if s_start > now_min:
                title = slot.item.raw_text if slot.item else "task"
                upcoming_barriers.append((s_start, f"scheduled '{title}'"))

    upcoming_barriers.append((day_end_min, "end of active day"))
    upcoming_barriers.sort(key=lambda x: x[0])
    next_barrier_min, next_barrier_label = upcoming_barriers[0]
    gap_minutes = max(0, next_barrier_min - now_min)

    # 4. Check if off-hours
    is_off_hours = now_min < day_start_min or now_min >= day_end_min

    # 5. Check if inside preferred deep work window
    deep_intervals = parse_deep_hours(prefs.preferred_deep_hours)
    is_deep_work = False
    deep_remaining = gap_minutes
    deep_window_str = ""
    for d_start, d_end in deep_intervals:
        if d_start <= now_min < d_end:
            is_deep_work = True
            deep_remaining = min(gap_minutes, d_end - now_min)
            deep_window_str = f"{_fmt12(minutes_to_time(d_start))} - {_fmt12(minutes_to_time(d_end))}"
            break


    # 6. Filter candidate items (status == 'inbox')
    candidates = [it for it in inbox_items if getattr(it, "status", "inbox") == "inbox"]

    if not candidates:
        if is_off_hours:
            return NowSuggestion(
                context_type="off_hours",
                current_time=now,
                reason="Outside scheduled active hours. Rest, reflect, or wind down for the day.",
                free_minutes_remaining=gap_minutes,
            )
        return NowSuggestion(
            context_type="clear",
            current_time=now,
            reason="You're all caught up! No pending inbox items.",
            free_minutes_remaining=gap_minutes,
        )

    # 7. Score candidates based on current context
    scored_candidates = []
    for item in candidates:
        eff_dur = get_effective_duration(item, prefs)
        score = compute_urgency_score(item, target_date, prefs, now)

        if is_deep_work:
            # Deep work mode: strong boost for high priority or complex tasks
            if (item.priority or 3) >= 4 or item.category in ("task", "deadline") or eff_dur >= 45:
                score += 0.5
            if eff_dur <= deep_remaining:
                score += 0.3
            elif eff_dur > gap_minutes:
                score -= 0.4
        elif is_off_hours:
            # Off hours mode: prefer quick ideas/reminders/light chores
            if (item.priority or 3) <= 2 or item.category in ("idea", "reminder") or eff_dur <= 15:
                score += 0.4
            else:
                score -= 0.3
        else:
            # Regular free gap mode:
            if eff_dur <= gap_minutes:
                # Fits within gap!
                score += 0.4
                # Reward filling the gap well
                fill_ratio = min(1.0, eff_dur / max(1, gap_minutes))
                score += 0.2 * fill_ratio
            else:
                # Exceeds current free gap
                score -= 0.5

        scored_candidates.append((score, eff_dur, item))

    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    best_score, best_dur, best_item = scored_candidates[0]

    # 8. Formulate contextual reason
    if is_deep_work:
        reason = (
            f"Preferred deep work window ({deep_window_str}, {deep_remaining}m left). "
            f"Top priority focus task matching your peak energy."
        )
        ctx_type = "deep_work"
    elif is_off_hours:
        reason = (
            f"Outside regular active hours ({gap_minutes}m before day start/wind down). "
            f"Recommended light task or review."
        )
        ctx_type = "off_hours"
    else:
        reason = (
            f"{gap_minutes}m free gap before {next_barrier_label}. "
            f"Best-fit task for your available time."
        )
        ctx_type = "free_gap"

    return NowSuggestion(
        context_type=ctx_type,
        current_time=now,
        reason=reason,
        item=best_item,
        free_minutes_remaining=gap_minutes,
        effective_duration_min=best_dur,
    )

