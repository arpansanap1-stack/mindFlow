import pytest
from app.models import User, Item
from app.auth import hash_password


@pytest.fixture
def admin_user(db_session):
    admin = User(
        email="test_superadmin@mindflow.local",
        password_hash=hash_password("AdminPass123!"),
        role="ADMIN",
        status="ACTIVE",
    )
    db_session.add(admin)
    db_session.commit()
    return admin


def test_admin_create_user_flow(raw_client, admin_user, auth_headers):
    headers = auth_headers(admin_user)

    # 1. Admin creates user
    res = raw_client.post(
        "/admin/users",
        json={"email": "newly_created@mindflow.local", "role": "USER"},
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "newly_created@mindflow.local"
    assert data["role"] == "USER"
    assert data["status"] == "ACTIVE"
    assert data["must_change_password"] is True
    assert "initial_password" in data
    temp_pass = data["initial_password"]

    # 2. Created user can log in using temporary password
    login_res = raw_client.post(
        "/auth/login",
        json={"email": "newly_created@mindflow.local", "password": temp_pass},
    )
    assert login_res.status_code == 200
    assert login_res.json()["user"]["must_change_password"] is True


def test_admin_disable_and_reenable_user(raw_client, admin_user, db_session, auth_headers):
    headers = auth_headers(admin_user)

    # Create target user with an item
    target = User(
        email="target_user@mindflow.local",
        password_hash=hash_password("UserPass123!"),
        role="USER",
        status="ACTIVE",
    )
    db_session.add(target)
    db_session.commit()

    item = Item(user_id=target.id, raw_text="Important target task")
    db_session.add(item)
    db_session.commit()

    # 1. Admin disables target user
    dis_res = raw_client.patch(
        f"/admin/users/{target.id}/status",
        json={"status": "DISABLED"},
        headers=headers,
    )
    assert dis_res.status_code == 200
    assert dis_res.json()["status"] == "DISABLED"

    # 2. Disabled user cannot log in
    login_fail = raw_client.post(
        "/auth/login",
        json={"email": "target_user@mindflow.local", "password": "UserPass123!"},
    )
    assert login_fail.status_code == 403
    assert "Account is disabled" in login_fail.json()["detail"]

    # 3. Item is still intact in the database
    db_item = db_session.query(Item).filter(Item.id == item.id).first()
    assert db_item is not None

    # 4. Admin re-enables target user
    en_res = raw_client.patch(
        f"/admin/users/{target.id}/status",
        json={"status": "ACTIVE"},
        headers=headers,
    )
    assert en_res.status_code == 200
    assert en_res.json()["status"] == "ACTIVE"

    # 5. User can now log in again
    login_ok = raw_client.post(
        "/auth/login",
        json={"email": "target_user@mindflow.local", "password": "UserPass123!"},
    )
    assert login_ok.status_code == 200


def test_admin_cannot_disable_or_delete_self(raw_client, admin_user, auth_headers):
    headers = auth_headers(admin_user)

    # Cannot disable self
    dis_self = raw_client.patch(
        f"/admin/users/{admin_user.id}/status",
        json={"status": "DISABLED"},
        headers=headers,
    )
    assert dis_self.status_code == 400
    assert "Administrators cannot disable their own account" in dis_self.json()["detail"]

    # Cannot delete self
    del_self = raw_client.delete(f"/admin/users/{admin_user.id}", headers=headers)
    assert del_self.status_code == 400
    assert "Administrators cannot delete their own account" in del_self.json()["detail"]


def test_admin_reset_user_password(raw_client, admin_user, db_session, auth_headers):
    headers = auth_headers(admin_user)

    target = User(
        email="reset_target@mindflow.local",
        password_hash=hash_password("InitialSecret123!"),
        role="USER",
        status="ACTIVE",
    )
    db_session.add(target)
    db_session.commit()

    reset_res = raw_client.post(f"/admin/users/{target.id}/reset-password", headers=headers)
    assert reset_res.status_code == 200
    new_temp = reset_res.json()["temporary_password"]

    # Login with new temp password succeeds
    login_res = raw_client.post(
        "/auth/login",
        json={"email": "reset_target@mindflow.local", "password": new_temp},
    )
    assert login_res.status_code == 200


def test_admin_delete_user(raw_client, admin_user, db_session, auth_headers):
    headers = auth_headers(admin_user)

    target = User(
        email="delete_me@mindflow.local",
        password_hash=hash_password("Pass123!"),
        role="USER",
        status="ACTIVE",
    )
    db_session.add(target)
    db_session.commit()

    item = Item(user_id=target.id, raw_text="Delete cascade test")
    db_session.add(item)
    db_session.commit()
    item_id = item.id

    del_res = raw_client.delete(f"/admin/users/{target.id}", headers=headers)
    assert del_res.status_code == 204

    # Verify user and cascaded items are gone
    assert db_session.query(User).filter(User.id == target.id).first() is None
    assert db_session.query(Item).filter(Item.id == item_id).first() is None

