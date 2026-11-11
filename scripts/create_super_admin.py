#!/usr/bin/env python3
"""
StudyMate AI - Secure Super Administrator Provisioning CLI

Usage:
    python scripts/create_super_admin.py --email admin@studymate.ai --name "Platform Administrator" --password "SuperSecretPass123!"

Or run interactively (will prompt securely for password without echo).
"""

import argparse
import asyncio
import getpass
import re
import sys
from pathlib import Path

# Add apps/backend to sys.path so backend modules can be imported
backend_path = Path(__file__).resolve().parent.parent / "apps" / "backend"
sys.path.insert(0, str(backend_path))

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole, UserStatus


def validate_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


async def create_super_admin(email: str, full_name: str, password: str) -> None:
    if len(password) < 8:
        print("[ERROR] Password must be at least 8 characters long.")
        sys.exit(1)

    if not validate_email(email):
        print(f"[ERROR] '{email}' is not a valid email address.")
        sys.exit(1)

    email_clean = email.strip().lower()
    hashed = hash_password(password)

    async with AsyncSessionLocal() as session:
        # Check if user already exists
        stmt = select(User).where(User.email == email_clean)
        res = await session.execute(stmt)
        existing = res.scalar_one_or_none()

        if existing:
            print(f"[INFO] User with email '{email_clean}' already exists.")
            if existing.role == UserRole.SUPER_ADMIN:
                print(f"[INFO] User is already a SUPER_ADMIN. Updating password...")
                existing.hashed_password = hashed
                existing.status = UserStatus.ACTIVE
                await session.commit()
                print(f"[SUCCESS] Super admin password updated successfully for {email_clean}!")
                return
            else:
                promote = input(f"User has role '{existing.role.value}'. Promote to SUPER_ADMIN? (y/N): ")
                if promote.strip().lower() == "y":
                    existing.role = UserRole.SUPER_ADMIN
                    existing.status = UserStatus.ACTIVE
                    existing.hashed_password = hashed
                    await session.commit()
                    print(f"[SUCCESS] Successfully promoted {email_clean} to SUPER_ADMIN!")
                    return
                else:
                    print("[ABORTED] No changes made.")
                    return

        # Create new super admin
        admin_user = User(
            email=email_clean,
            full_name=full_name.strip(),
            hashed_password=hashed,
            role=UserRole.SUPER_ADMIN,
            status=UserStatus.ACTIVE,
        )
        session.add(admin_user)
        await session.commit()
        await session.refresh(admin_user)

        print("\n" + "=" * 60)
        print(" [SUCCESS] Super Administrator account provisioned!")
        print(f" ID:        {admin_user.id}")
        print(f" Email:     {admin_user.email}")
        print(f" Full Name: {admin_user.full_name}")
        print(f" Role:      {admin_user.role.value}")
        print(f" Status:    {admin_user.status.value}")
        print("=" * 60 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Provision a StudyMate AI Super Administrator")
    parser.add_argument("--email", help="Super admin email address")
    parser.add_argument("--name", help="Super admin full name")
    parser.add_argument("--password", help="Super admin secure password")

    args = parser.parse_args()

    email = args.email
    if not email:
        email = input("Enter Super Admin Email: ").strip()

    name = args.name
    if not name:
        name = input("Enter Super Admin Full Name (e.g. Master Admin): ").strip()
        if not name:
            name = "System Administrator"

    password = args.password
    if not password:
        password = getpass.getpass("Enter Super Admin Password (min 8 chars): ")
        confirm_pass = getpass.getpass("Confirm Super Admin Password: ")
        if password != confirm_pass:
            print("[ERROR] Passwords do not match.")
            sys.exit(1)

    asyncio.run(create_super_admin(email, name, password))


if __name__ == "__main__":
    main()
