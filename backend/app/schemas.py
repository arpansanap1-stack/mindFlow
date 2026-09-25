import datetime as dt
from typing import Optional, Literal, List, Dict
from pydantic import BaseModel, Field, ConfigDict, model_validator

CategoryType = Literal["task", "idea", "reminder", "deadline", "study", "project_idea", "question", "note", "random_thought"]
StatusType = Literal["inbox", "scheduled", "done", "skipped"]


class ItemCreate(BaseModel):
    raw_text: str = Field(..., min_length=1, description="Raw input text captured by user")
    category: Optional[CategoryType] = Field(None, description="Item category")
    priority: Optional[int] = Field(None, ge=1, le=5, description="Priority from 1 (lowest) to 5 (highest)")
    est_duration_min: Optional[int] = Field(None, ge=1, description="Estimated duration in minutes")
    deadline: Optional[dt.datetime] = Field(None, description="Parsed or set deadline")
    topic_tag: Optional[str] = Field(None, max_length=100, description="Topic or context tag")


class ItemUpdate(BaseModel):
    raw_text: Optional[str] = Field(None, min_length=1)
    category: Optional[CategoryType] = None
    priority: Optional[int] = Field(None, ge=1, le=5)
    est_duration_min: Optional[int] = Field(None, ge=1)
    deadline: Optional[dt.datetime] = None
    status: Optional[StatusType] = None
    topic_tag: Optional[str] = Field(None, max_length=100)


class ItemComplete(BaseModel):
    actual_duration: Optional[int] = Field(None, ge=0, description="Actual time taken in minutes")


class ItemResponse(BaseModel):
    id: int
    user_id: int
    raw_text: str
    category: Optional[CategoryType] = None
    priority: Optional[int] = None
    est_duration_min: Optional[int] = None
    deadline: Optional[dt.datetime] = None
    status: StatusType
    topic_tag: Optional[str] = None
    created_at: dt.datetime

    model_config = ConfigDict(from_attributes=True)


# --- Routine Blocks Schemas ---

class RoutineBlockBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: dt.time = Field(..., description="Start time (HH:MM:SS or HH:MM)")
    end_time: dt.time = Field(..., description="End time (HH:MM:SS or HH:MM)")
    label: Optional[str] = Field(None, max_length=255, description="Label for fixed routine")
    fixed: bool = Field(True, description="Whether this block is fixed")

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.start_time >= self.end_time:
            raise ValueError("end_time must be strictly after start_time")
        return self


class RoutineBlockCreate(RoutineBlockBase):
    pass


class RoutineBlockUpdate(BaseModel):
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_time: Optional[dt.time] = None
    end_time: Optional[dt.time] = None
    label: Optional[str] = Field(None, max_length=255)
    fixed: Optional[bool] = None

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.start_time is not None and self.end_time is not None:
            if self.start_time >= self.end_time:
                raise ValueError("end_time must be strictly after start_time")
        return self


class RoutineBlockResponse(BaseModel):
    id: int
    user_id: int
    day_of_week: int
    start_time: dt.time
    end_time: dt.time
    label: Optional[str] = None
    fixed: bool = True

    model_config = ConfigDict(from_attributes=True)


# --- User Preferences Schemas ---

class UserPrefsUpdate(BaseModel):
    timezone: Optional[str] = Field(None, min_length=1, max_length=64, description="IANA timezone, e.g. Asia/Kolkata")
    preferred_deep_hours: Optional[List[str]] = Field(
        None,
        description="Preferred focus windows in HH:MM-HH:MM format, e.g. ['09:00-11:00']"
    )
    break_duration_pref: Optional[int] = Field(
        None,
        ge=0,
        le=120,
        description="Preferred break duration in minutes"
    )
    category_duration_multiplier: Optional[Dict[str, float]] = Field(
        None,
        description="Duration multipliers per category e.g. {'task': 1.2, 'study': 1.4}"
    )


class UserPrefsResponse(BaseModel):
    user_id: int
    preferred_deep_hours: List[str] = []
    break_duration_pref: int = 10
    category_duration_multiplier: Dict[str, float] = {}
    timezone: str = "UTC"

    model_config = ConfigDict(from_attributes=True)


# --- Schedule Schemas ---

class ScheduleSlotResponse(BaseModel):
    id: int
    user_id: int
    item_id: Optional[int] = None
    date: dt.date
    start_time: dt.time
    end_time: dt.time
    auto_generated: bool = True
    item: Optional[ItemResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ScheduleRunRequest(BaseModel):
    date: Optional[dt.date] = Field(None, description="Date to schedule for (defaults to today)")


class ScheduleRunResponse(BaseModel):
    date: dt.date
    scheduled_count: int
    unplaceable_count: int
    rescheduled_count: int
    slots: List[ScheduleSlotResponse]
    unplaceable_items: List[ItemResponse]


# --- Feedback & Learning Schemas ---

class FeedbackStatsResponse(BaseModel):
    total_entries: int
    samples_with_duration: int
    category_counts: Dict[str, int]
    topic_counts: Dict[str, int]
    multipliers: Dict[str, float]


class FeedbackRecalibrateResponse(BaseModel):
    total_samples: int
    category_counts: Dict[str, int]
    multipliers: Dict[str, float]
    updated_categories: List[str]


# --- "What should I do now?" Schemas ---

class NowSuggestionResponse(BaseModel):
    context_type: str = Field(
        ...,
        description="'routine' | 'scheduled_slot' | 'deep_work' | 'free_gap' | 'off_hours' | 'clear'",
    )
    current_time: dt.datetime
    reason: str
    item: Optional[ItemResponse] = None
    slot: Optional[ScheduleSlotResponse] = None
    routine_block: Optional[RoutineBlockResponse] = None
    free_minutes_remaining: Optional[int] = None
    effective_duration_min: Optional[int] = None


class SuggestionActionRequest(BaseModel):
    item_id: int
    action: Literal["accept", "dismiss"]


class SuggestionActionResponse(BaseModel):
    status: str
    item_id: int
    action: str


# --- User & Auth Schemas ---

UserRole = Literal["ADMIN", "USER"]
UserStatus = Literal["ACTIVE", "DISABLED"]


class UserResponse(BaseModel):
    id: int
    email: str
    role: UserRole
    status: UserStatus
    must_change_password: bool = False
    last_login: Optional[dt.datetime] = None
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=255, description="User email address")
    role: UserRole = Field("USER", description="User role: ADMIN or USER")
    temporary_password: Optional[str] = Field(
        None,
        min_length=8,
        description="Optional initial password. If omitted, a secure temporary password is generated.",
    )


class UserCreateResponse(UserResponse):
    initial_password: Optional[str] = Field(
        None,
        description="Returned only upon initial creation to present to admin/user",
    )


class UserUpdateStatus(BaseModel):
    status: UserStatus = Field(..., description="ACTIVE or DISABLED")


class UserResetPassword(BaseModel):
    new_password: Optional[str] = Field(
        None,
        min_length=8,
        description="Optional new password. If omitted, a secure temporary password is generated.",
    )


class UserResetPasswordResponse(BaseModel):
    status: str = "success"
    user_id: int
    temporary_password: str


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=1, description="Account email or username")
    password: str = Field(..., min_length=1, description="Account password")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, description="New password, minimum 8 characters")

