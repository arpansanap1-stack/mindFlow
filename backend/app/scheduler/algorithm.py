from datetime import date, time, datetime, timezone
from typing import List, Tuple, Optional, Dict

from app.scheduler.types import (
    InboxItem,
    RoutineBlockItem,
    ExistingSlotItem,
    ScheduledSlotProposal,
    ScheduleResult,
    SchedulerPrefs,
)


def time_to_minutes(t: time) -> int:
    """Convert time to minutes since midnight."""
    return t.hour * 60 + t.minute


def minutes_to_time(m: int) -> time:
    """Convert minutes since midnight to time object."""
    m = max(0, min(1439, m))
    return time(hour=m // 60, minute=m % 60)


def parse_deep_hours(deep_hours: List[str]) -> List[Tuple[int, int]]:
    """Parse list of 'HH:MM-HH:MM' strings into (start_min, end_min) intervals."""
    intervals = []
    for h in deep_hours:
        if not h or "-" not in h:
            continue
        try:
            parts = h.split("-")
            s_parts = parts[0].strip().split(":")
            e_parts = parts[1].strip().split(":")
            s_min = int(s_parts[0]) * 60 + int(s_parts[1])
            e_min = int(e_parts[0]) * 60 + int(e_parts[1])
            if s_min < e_min:
                intervals.append((s_min, e_min))
        except (ValueError, IndexError):
            continue
    return intervals


def subtract_intervals(
    free_intervals: List[Tuple[int, int]],
    blocked_intervals: List[Tuple[int, int]],
) -> List[Tuple[int, int]]:
    """Subtract blocked intervals from free intervals."""
    result = list(free_intervals)

    for b_start, b_end in blocked_intervals:
        new_result = []
        for f_start, f_end in result:
            # Case 1: No overlap
            if b_end <= f_start or b_start >= f_end:
                new_result.append((f_start, f_end))
            # Case 2: Block covers entire free interval
            elif b_start <= f_start and b_end >= f_end:
                continue
            # Case 3: Block cuts off start of free interval
            elif b_start <= f_start and b_end < f_end:
                new_result.append((b_end, f_end))
            # Case 4: Block cuts off end of free interval
            elif b_start > f_start and b_end >= f_end:
                new_result.append((f_start, b_start))
            # Case 5: Block splits free interval in two
            else:
                new_result.append((f_start, b_start))
                new_result.append((b_end, f_end))
        result = new_result

    # Filter out empty or negative intervals and sort
    return sorted([inv for inv in result if inv[1] > inv[0]], key=lambda x: x[0])


def compute_urgency_score(
    item: InboxItem,
    target_date: date,
    prefs: SchedulerPrefs,
    now: Optional[datetime] = None,
) -> float:
    """
    Compute urgency_score = w1*deadline_proximity + w2*priority + w3*days_in_inbox (SPEC 1.6)
    Weights default to 0.5 / 0.3 / 0.2
    """
    if now is None:
        now = datetime.now()

    w_deadline = prefs.weights.get("deadline", 0.5)
    w_priority = prefs.weights.get("priority", 0.3)
    w_inbox = prefs.weights.get("days_in_inbox", 0.2)

    # 1. Deadline proximity (0.0 to 1.0)
    deadline_score = 0.0
    if item.deadline:
        deadline_date = (
            item.deadline.date()
            if isinstance(item.deadline, datetime)
            else item.deadline
        )
        diff_days = (deadline_date - target_date).days
        if diff_days < 0:
            deadline_score = 1.0  # Overdue
        elif diff_days == 0:
            deadline_score = 1.0  # Due today
        elif diff_days == 1:
            deadline_score = 0.85 # Due tomorrow
        elif diff_days <= 3:
            deadline_score = 0.65
        elif diff_days <= 7:
            deadline_score = 0.45
        else:
            deadline_score = 0.20

    # 2. Priority score (1-5 normalized to 0.2 - 1.0)
    priority_val = item.priority if item.priority is not None else 3
    priority_score = max(1, min(5, priority_val)) / 5.0

    # 3. Days in inbox
    inbox_score = 0.0
    if item.created_at:
        naive_now = now.replace(tzinfo=None)
        naive_created = (
            item.created_at.replace(tzinfo=None)
            if isinstance(item.created_at, datetime)
            else naive_now
        )
        age_days = max(0.0, (naive_now - naive_created).total_seconds() / 86400.0)
        inbox_score = min(age_days / 7.0, 1.0)

    return (
        w_deadline * deadline_score +
        w_priority * priority_score +
        w_inbox * inbox_score
    )


def schedule_day(
    target_date: date,
    inbox_items: List[InboxItem],
    routine_blocks: List[RoutineBlockItem],
    existing_slots: List[ExistingSlotItem],
    prefs: SchedulerPrefs,
    now: Optional[datetime] = None,
) -> ScheduleResult:
    """
    Pure Greedy Bin-Packing Scheduler (SPEC 1.6).
    Takes (target_date, inbox_items, routine_blocks, existing_slots, prefs)
    and returns proposed slots and unplaceable items.
    """
    # If explicit 'now' is provided and scheduling for a past date, reject placement
    if now is not None:
        now_date = now.date() if isinstance(now, datetime) else date.today()
        if target_date < now_date:
            return ScheduleResult(
                scheduled_slots=[],
                unplaceable_item_ids=[item.id for item in inbox_items],
                explanations={
                    item.id: f"Cannot schedule items on a past date ({target_date})."
                    for item in inbox_items
                },
            )

    # 1. Base active day window (e.g. 08:00 to 22:00)
    day_start_min = time_to_minutes(prefs.day_start)
    day_end_min = time_to_minutes(prefs.day_end)

    # If scheduling for today with current time known, do not schedule slots in the past
    if now is not None:
        now_date = now.date() if isinstance(now, datetime) else date.today()
        if target_date == now_date:
            now_min = now.hour * 60 + now.minute
            # Round up to nearest 5 minutes
            rounded_now = ((now_min + 4) // 5) * 5

            if rounded_now >= 1435:
                # Past 23:55, day has ended
                return ScheduleResult(
                    scheduled_slots=[],
                    unplaceable_item_ids=[item.id for item in inbox_items],
                    explanations={
                        item.id: "Day active hours have ended. Please schedule for tomorrow."
                        for item in inbox_items
                    },
                )
            elif rounded_now >= day_end_min:
                # Active late evening; allow window up to midnight
                effective_start = rounded_now
                effective_end = min(1440, rounded_now + 120)
            else:
                effective_start = max(day_start_min, rounded_now)
                effective_end = day_end_min
        else:
            effective_start = day_start_min
            effective_end = day_end_min
    else:
        effective_start = day_start_min
        effective_end = day_end_min

    free_intervals: List[Tuple[int, int]] = [(effective_start, effective_end)]


    # Collect blocked intervals for target_date
    blocked_intervals: List[Tuple[int, int]] = []

    # Fixed routine blocks for this weekday (0=Mon, 6=Sun)
    target_weekday = target_date.weekday()
    for block in routine_blocks:
        if block.day_of_week == target_weekday and block.fixed:
            b_start = time_to_minutes(block.start_time)
            b_end = time_to_minutes(block.end_time)
            blocked_intervals.append((b_start, b_end))

    # Existing slots for target_date
    for slot in existing_slots:
        if slot.date == target_date:
            s_start = time_to_minutes(slot.start_time)
            s_end = time_to_minutes(slot.end_time)
            blocked_intervals.append((s_start, s_end))

    # Subtract all blocked intervals to find today's free time blocks
    free_intervals = subtract_intervals(free_intervals, blocked_intervals)

    # 2. Score and sort inbox items by urgency_score descending
    scored_items = []
    for item in inbox_items:
        score = compute_urgency_score(item, target_date, prefs, now)
        scored_items.append((score, item))

    # Sort descending by score
    scored_items.sort(key=lambda x: x[0], reverse=True)

    # 3. Parse preferred deep work hours
    deep_intervals = parse_deep_hours(prefs.preferred_deep_hours)
    break_duration = max(0, prefs.break_duration_pref)

    scheduled_proposals: List[ScheduledSlotProposal] = []
    unplaceable_ids: List[int] = []
    explanations: Dict[int, str] = {}

    for score, item in scored_items:
        # Calculate duration with category/topic multiplier
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
        adjusted_duration = max(5, int(round(base_dur * multiplier)))

        is_deep_work = (
            (item.priority or 3) >= 4 or
            adjusted_duration >= 45 or
            item.category in ("task", "deadline")
        )

        chosen_interval_idx = -1
        slot_start_min = -1

        # Prefer slots inside preferred_deep_hours for high-priority/focus items
        if is_deep_work and deep_intervals:
            for d_start, d_end in deep_intervals:
                for idx, (f_start, f_end) in enumerate(free_intervals):
                    # Check overlap between free interval and deep hours
                    overlap_start = max(f_start, d_start)
                    overlap_end = min(f_end, d_end)
                    if overlap_end - overlap_start >= adjusted_duration:
                        chosen_interval_idx = idx
                        slot_start_min = overlap_start
                        break
                if chosen_interval_idx != -1:
                    break

        # If no deep hour slot was found/applicable, pick earliest available free interval
        if chosen_interval_idx == -1:
            for idx, (f_start, f_end) in enumerate(free_intervals):
                if f_end - f_start >= adjusted_duration:
                    chosen_interval_idx = idx
                    slot_start_min = f_start
                    break

        # If still no slot fits, mark unplaceable
        if chosen_interval_idx == -1:
            unplaceable_ids.append(item.id)
            explanations[item.id] = (
                f"Could not fit duration of {adjusted_duration} min into remaining free blocks today."
            )
            continue

        # Valid slot found!
        slot_end_min = slot_start_min + adjusted_duration
        proposal = ScheduledSlotProposal(
            item_id=item.id,
            date=target_date,
            start_time=minutes_to_time(slot_start_min),
            end_time=minutes_to_time(slot_end_min),
            auto_generated=True,
        )
        scheduled_proposals.append(proposal)
        time_12 = proposal.start_time.strftime("%I:%M %p").lstrip("0")
        explanations[item.id] = f"Scheduled at {time_12} (score: {score:.2f})"


        # Break constraint (SPEC 1.6):
        # "Never schedule two duration >45min deep-work items back-to-back without inserting break_duration_pref minutes"
        # If this item was deep work > 45min, reserve break_duration right after it.
        blocked_end_min = slot_end_min
        if adjusted_duration > 45 and break_duration > 0:
            blocked_end_min = min(day_end_min, slot_end_min + break_duration)

        # Carve out the scheduled block + break buffer from free intervals
        free_intervals = subtract_intervals(
            free_intervals,
            [(slot_start_min, blocked_end_min)]
        )

    return ScheduleResult(
        scheduled_slots=scheduled_proposals,
        unplaceable_item_ids=unplaceable_ids,
        explanations=explanations,
    )

