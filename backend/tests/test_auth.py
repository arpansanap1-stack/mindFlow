import pytest
from app.models import User
from app.auth import hash_password, create_access_token


def test_login_success(raw_client, db_session):
    user = User(
        email="test_success@mindflow.local",
        password_hash=hash_password("Secret123!"),
        role="USER",
        status="ACTIVE",
    )
    db_session.add(user)
    db_session.commit()

    res = raw_client.post("/auth/login", json={"email": "test_success@mindflow.local", "password": "Secret123!"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "test_success@mindflow.local"
    assert data["user"]["role"] == "USER"
    assert "password_hash" not in data["user"]


def test_login_invalid_password(raw_client, db_session):
    user = User(
        email="test_badpass@mindflow.local",
        password_hash=hash_password("Secret123!"),
        role="USER",
        status="ACTIVE",
    )
    db_session.add(user)
    db_session.commit()

    res = raw_client.post("/auth/login", json={"email": "test_badpass@mindflow.local", "password": "WrongPassword"})
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]


def test_login_nonexistent_user(raw_client):
    res = raw_client.post("/auth/login", json={"email": "nonexistent@mindflow.local", "password": "Password123!"})
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]


def test_login_disabled_account(raw_client, db_session):
    user = User(
        email="disabled_user@mindflow.local",
        password_hash=hash_password("Secret123!"),
        role="USER",
        status="DISABLED",
    )
    db_session.add(user)
    db_session.commit()

    res = raw_client.post("/auth/login", json={"email": "disabled_user@mindflow.local", "password": "Secret123!"})
    assert res.status_code == 403
    assert "Account is disabled" in res.json()["detail"]


def test_get_current_user_profile(raw_client, db_session, auth_headers):
    user = User(
        email="me_test@mindflow.local",
        password_hash=hash_password("Secret123!"),
        role="USER",
        status="ACTIVE",
    )
    db_session.add(user)
    db_session.commit()

    headers = auth_headers(user)
    res = raw_client.get("/auth/me", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "me_test@mindflow.local"
    assert data["role"] == "USER"
    assert "password_hash" not in data


def test_get_current_user_unauthenticated(raw_client):
    res = raw_client.get("/auth/me")
    assert res.status_code == 401


def test_change_password_flow(raw_client, db_session, auth_headers):
    user = User(
        email="change_pwd@mindflow.local",
        password_hash=hash_password("OldPassword123!"),
        role="USER",
        status="ACTIVE",
        must_change_password=True,
    )
    db_session.add(user)
    db_session.commit()

    headers = auth_headers(user)

    # 1. Wrong current password fails
    res_wrong = raw_client.post(
        "/auth/change-password",
        json={"current_password": "IncorrectPassword", "new_password": "NewSecret123!"},
        headers=headers,
    )
    assert res_wrong.status_code == 400

    # 2. Same password fails
    res_same = raw_client.post(
        "/auth/change-password",
        json={"current_password": "OldPassword123!", "new_password": "OldPassword123!"},
        headers=headers,
    )
    assert res_same.status_code == 400

    # 3. Successful change
    res_ok = raw_client.post(
        "/auth/change-password",
        json={"current_password": "OldPassword123!", "new_password": "NewSecret123!"},
        headers=headers,
    )
    assert res_ok.status_code == 200

    # Verify must_change_password is now False
    db_session.refresh(user)
    assert user.must_change_password is False

    # Verify login with new password works
    login_res = raw_client.post(
        "/auth/login",
        json={"email": "change_pwd@mindflow.local", "password": "NewSecret123!"},
    )
    assert login_res.status_code == 200

