import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
import dateparser

from app.classification.types import ClassificationResult, CategoryType


REMINDER_PATTERNS = [
    r"\bremind\s+(?:me\s+)?(?:to\s+)?",
    r"\bremember\s+to\b",
    r"\bdon't\s+forget\s+(?:to\s+)?",
    r"\bnotify\s+(?:me\s+)?(?:to\s+)?",
    r"^reminder\s*:\s*",
]

IDEA_PATTERNS = [
    r"\b(?:explore|learn|read\s+about|look\s+into|research|think\s+about|brainstorm|consider|what\s+if|check\s+out|experiment\s+with|try\s+out)\b",
    r"^idea\s*:\s*",
]

TASK_VERBS = [
    r"\b(?:buy|purchase|get|order|submit|finish|complete|send|write|draft|prepare|fix|repair|clean|schedule|book|call|email|organize|update|implement|deploy|build|refactor|test|review|pay|file|wash|print|install|contact)\b"
]

DEADLINE_PATTERNS = [
    r"\b(?:deadline|due\s+date|final\s+day)\b",
    r"^deadline\s*:\s*",
]

# Priority indicators
PRIORITY_5_PATTERNS = [r"\b(?:urgent|asap|critical|immediately|emergency|high\s+priority|p1|!urgent)\b"]
PRIORITY_4_PATTERNS = [r"\b(?:important|must|needed\s+soon|p2)\b"]
PRIORITY_2_PATTERNS = [r"\b(?:low\s+priority|someday|when\s+free|nice\s+to\s+have|no\s+rush|eventually|p4|p5)\b"]

# Topic keywords mapping
TOPIC_KEYWORDS = {
    "dev": [r"\b(?:code|pr|pull\s+request|git|github|bug|deploy|api|backend|frontend|database|sql|docker|test)\b"],
    "health": [r"\b(?:doctor|dentist|gym|workout|medicine|medication|pill|run|exercise|clinic|health)\b"],
    "finance": [r"\b(?:tax|taxes|bill|invoice|bank|rent|mortgage|paycheck|salary|finance|budget)\b"],
    "study": [r"\b(?:study|exam|homework|assignment|course|class|lecture|paper|reading)\b"],
    "work": [r"\b(?:meeting|client|report|presentation|colleague|boss|interview|quarterly|sync)\b"],
    "personal": [r"\b(?:groceries|grocery|laundry|clean|cook|dishes|dinner|lunch|haircut|errand)\b"],
}


def extract_duration(text: str) -> Tuple[Optional[int], str]:
    """
    Extract explicit duration from text, e.g.:
    - '30 mins', '30m', '1 hour', '1.5 hours', '45 min', 'for 20 minutes'
    Returns (duration_in_min, cleaned_text)
    """
    # Pattern: X hours and Y mins
    m_combo = re.search(r"\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?|m)?\b", text, re.I)
    if m_combo:
        hours = float(m_combo.group(1))
        mins = int(m_combo.group(2))
        total = int(hours * 60) + mins
        cleaned = text[:m_combo.start()] + text[m_combo.end():]
        return total, cleaned.strip()

    # Pattern: X hours
    m_hours = re.search(r"\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b", text, re.I)
    if m_hours:
        hours = float(m_hours.group(1))
        total = int(hours * 60)
        cleaned = text[:m_hours.start()] + text[m_hours.end():]
        return total, cleaned.strip()

    # Pattern: X minutes
    m_mins = re.search(r"\b(?:for\s+)?(\d+)\s*(?:minutes?|mins?|m)\b", text, re.I)
    if m_mins:
        mins = int(m_mins.group(1))
        cleaned = text[:m_mins.start()] + text[m_mins.end():]
        return mins, cleaned.strip()

    # Pattern: "half an hour"
    if re.search(r"\bhalf\s+an\s+hour\b", text, re.I):
        cleaned = re.sub(r"\bhalf\s+an\s+hour\b", "", text, flags=re.I).strip()
        return 30, cleaned

    return None, text


def extract_deadline_and_date(text: str, now: Optional[datetime] = None) -> Tuple[Optional[datetime], Optional[str]]:
    """
    Extract deadline or scheduled date/time using regex patterns and dateparser.
    Handles 'by Friday 5pm', 'due tomorrow', 'by Oct 15', 'before 3pm', etc.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    # Patterns indicating deadlines or dates
    date_intro_patterns = [
        r"\b(?:by|due|before|until)\s+([a-zA-Z0-9\s,:\/\-]+?)(?=$|\s*#|\s+for\s+\d|\s+p\d)",
        r"\b(?:deadline\s+is|due\s+on|at)\s+([a-zA-Z0-9\s,:\/\-]+?)(?=$|\s*#)",
        r"\b(tomorrow(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b",
        r"\b(next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b",
    ]

    settings = {
        "PREFER_DATES_FROM": "future",
        "RELATIVE_BASE": now.replace(tzinfo=None),
        "RETURN_AS_TIMEZONE_AWARE": False,
    }

    for pat in date_intro_patterns:
        match = re.search(pat, text, re.I)
        if match:
            date_str = match.group(1).strip()
            # Avoid parsing single small numbers as dates
            if date_str.isdigit() and len(date_str) < 4:
                continue
            parsed = dateparser.parse(date_str, settings=settings)
            if parsed:
                # If parsed date lacks time and matched "by ...", default to 17:00 (5pm end of day)
                if parsed.hour == 0 and parsed.minute == 0 and "12am" not in date_str.lower() and "midnight" not in date_str.lower():
                    parsed = parsed.replace(hour=17, minute=0, second=0)
                return parsed, match.group(0)

    return None, None


def extract_topic_tag(text: str) -> Optional[str]:
    """Extract topic tag from #hashtag or domain keywords."""
    # 1. Look for explicit hashtag
    hashtag_match = re.search(r"#([a-zA-Z0-9_\-]+)", text)
    if hashtag_match:
        return hashtag_match.group(1).lower()

    # 2. Match known topic domain keywords
    for topic, patterns in TOPIC_KEYWORDS.items():
        for pat in patterns:
            if re.search(pat, text, re.I):
                return topic

    return None


def extract_priority(text: str, deadline: Optional[datetime] = None, now: Optional[datetime] = None) -> int:
    """Determine priority (1 to 5) based on keywords and deadline proximity."""
    if now is None:
        now = datetime.now(timezone.utc)

    # Urgent keywords
    for pat in PRIORITY_5_PATTERNS:
        if re.search(pat, text, re.I):
            return 5

    # Important keywords
    for pat in PRIORITY_4_PATTERNS:
        if re.search(pat, text, re.I):
            return 4

    # Low priority keywords
    for pat in PRIORITY_2_PATTERNS:
        if re.search(pat, text, re.I):
            return 2

    # If deadline is within 24 hours, default priority to at least 4
    if deadline:
        naive_now = now.replace(tzinfo=None)
        diff = deadline - naive_now
        if diff <= timedelta(hours=24):
            return 4

    # Default baseline priority
    return 3


def classify_by_rules(text: str, now: Optional[datetime] = None) -> ClassificationResult:
    """
    Pure function: Rule-based classification pass (SPEC 1.5 layer 1).
    Extracts category, priority, duration, deadline, and topic_tag.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    cleaned_text = text.strip()

    # 1. Extract explicit duration
    duration, text_no_dur = extract_duration(cleaned_text)

    # 2. Extract deadline / dates
    deadline, matched_date_str = extract_deadline_and_date(cleaned_text, now=now)

    # 3. Extract topic tag
    topic_tag = extract_topic_tag(cleaned_text)

    # 4. Extract priority
    priority = extract_priority(cleaned_text, deadline=deadline, now=now)

    # 5. Category heuristics
    category: Optional[CategoryType] = None
    confidence = 0.0

    # Check reminder
    for pat in REMINDER_PATTERNS:
        if re.search(pat, cleaned_text, re.I):
            category = "reminder"
            confidence = 0.9
            break

    # Check deadline
    if not category:
        for pat in DEADLINE_PATTERNS:
            if re.search(pat, cleaned_text, re.I):
                category = "deadline"
                confidence = 0.85
                break

    # Check idea
    if not category:
        for pat in IDEA_PATTERNS:
            if re.search(pat, cleaned_text, re.I):
                category = "idea"
                confidence = 0.85
                break

    # Check task verbs
    if not category:
        for pat in TASK_VERBS:
            if re.search(pat, cleaned_text, re.I):
                category = "task"
                confidence = 0.85
                break

    # If an explicit date or deadline was detected and no category yet, default to task or deadline
    if not category and deadline:
        category = "deadline" if re.search(r"\b(?:due|deadline)\b", cleaned_text, re.I) else "task"
        confidence = 0.75

    # If duration was extracted but no category matched
    if not category and duration:
        category = "task"
        confidence = 0.7

    # Assign default duration if not specified
    if duration is None and category is not None:
        defaults = {
            "task": 30,
            "idea": 15,
            "reminder": 5,
            "deadline": 45,
        }
        est_duration = defaults.get(category, 30)
    else:
        est_duration = duration

    # If a category was found with good confidence
    if category is not None:
        if confidence == 0.0:
            confidence = 0.8
    else:
        # Unable to determine category with rules alone
        confidence = 0.2

    return ClassificationResult(
        category=category,
        priority=priority,
        est_duration_min=est_duration,
        deadline=deadline,
        topic_tag=topic_tag,
        confidence=confidence,
        layer_used="rule",
    )

