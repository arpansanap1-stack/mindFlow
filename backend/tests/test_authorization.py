import pytest
from app.models import User
from app.auth import hash_password


def test_unauthenticated_endpoints_rejected(raw_client):
    endpoints = [
        ("GET", "/items"),
        ("POST", "/items"),
        ("GET", "/routine"),
        ("POST", "/routine"),
        ("GET", "/schedule"),
        ("POST", "/schedule/run"),
        ("GET", "/prefs"),
        ("GET", "/feedback/stats"),
        ("GET", "/suggest/now"),
        ("GET", "/admin/users"),
        ("POST", "/admin/users"),
    ]
    for method, path in endpoints:
        if method == "GET":
            res = raw_client.get(path)
        else:
            res = raw_client.post(path, json={})
        assert res.status_code == 401, f"{method} {path} should return 401 for unauthenticated requests"


def test_normal_user_cannot_access_admin_endpoints(raw_client, db_session, auth_headers):
    normal_user = User(
        email="normal_user@mindflow.local",
        password_hash=hash_password("Pass123!"),
        role="USER",
        status="ACTIVE",
    )
    db_session.add(normal_user)
    db_session.commit()

    headers = auth_headers(normal_user)

    # GET /admin/users
    res_get = raw_client.get("/admin/users", headers=headers)
    assert res_get.status_code == 403
    assert "Administrator access required" in res_get.json()["detail"]

    # POST /admin/users
    res_post = raw_client.post("/admin/users", json={"email": "new@mindflow.local", "role": "USER"}, headers=headers)
    assert res_post.status_code == 403

    # PATCH /admin/users/{id}/status
    res_patch = raw_client.patch("/admin/users/1/status", json={"status": "DISABLED"}, headers=headers)
    assert res_patch.status_code == 403


def test_admin_user_can_access_admin_endpoints(raw_client, db_session, auth_headers):
    admin_user = User(
        email="admin_auth_test@mindflow.local",
        password_hash=hash_password("AdminPass123!"),
        role="ADMIN",
        status="ACTIVE",
    )
    db_session.add(admin_user)
    db_session.commit()

    headers = auth_headers(admin_user)

    res = raw_client.get("/admin/users", headers=headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

