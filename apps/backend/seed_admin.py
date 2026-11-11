"""StudyMate AI - Production Super Admin & System Seed Script

Creates or updates the initial Super Admin account and essential system configs
on a freshly deployed cloud database (Neon, Supabase, Render, Railway, AWS).

Usage:
    python seed_admin.py [--email <admin_email>] [--password <admin_pass>]
    or set environment variables:
    ADMIN_EMAIL="admin@studymate.ai" ADMIN_PASSWORD="SecurePassword123!" python seed_admin.py
"""

import argparse
import asyncio
import os
import sys
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.app_config import AppConfig
from app.models.user import User, UserRole, UserStatus


async def seed_production_database(email: str, password: str, full_name: str) -> None:
    print(f"==> [Seed] Initializing database session for {email}...")
    now = datetime.now(UTC)

    async with AsyncSessionLocal() as session:
        # 1. Check if super admin already exists
        stmt = select(User).where(User.email == email.strip().lower())
        res = await session.execute(stmt)
        existing_user = res.scalar_one_or_none()

        if existing_user:
            print(f"==> [Seed] User '{email}' already exists. Updating role to SUPER_ADMIN & status to ACTIVE.")
            existing_user.role = UserRole.SUPER_ADMIN
            existing_user.status = UserStatus.ACTIVE
            if password:
                existing_user.hashed_password = hash_password(password)
                existing_user.token_version += 1
            await session.commit()
            print(f"==> [Seed] Super Admin '{email}' successfully verified/updated!")
        else:
            print(f"==> [Seed] Creating new Super Admin account '{email}'...")
            new_admin = User(
                id=uuid.uuid4(),
                email=email.strip().lower(),
                hashed_password=hash_password(password),
                full_name=full_name,
                role=UserRole.SUPER_ADMIN,
                status=UserStatus.ACTIVE,
                token_version=1,
                created_at=now,
                updated_at=now,
            )
            session.add(new_admin)
            await session.commit()
            print(f"==> [Seed] Super Admin '{email}' successfully provisioned with SUPER_ADMIN privileges!")

        # 2. Seed baseline App Configurations if empty
        stmt_configs = select(AppConfig)
        res_configs = await session.execute(stmt_configs)
        configs = res_configs.scalars().all()

        if not configs:
            print("==> [Seed] Seeding baseline runtime application feature flags...")
            default_configs = [
                AppConfig(
                    id=uuid.uuid4(),
                    key="feature_pomodoro_ambient_sound",
                    value=True,
                    category="features",
                    description="Enable high-fidelity binaural ambient background sound in Pomodoro timer",
                    updated_at=now,
                ),
                AppConfig(
                    id=uuid.uuid4(),
                    key="ai_daily_budget_limit_usd",
                    value=10.0,
                    category="ai_governance",
                    description="Global daily AI budget spend ceiling in USD",
                    updated_at=now,
                ),
                AppConfig(
                    id=uuid.uuid4(),
                    key="maintenance_mode",
                    value=False,
                    category="system",
                    description="Global platform maintenance mode switch",
                    updated_at=now,
                ),
            ]
            session.add_all(default_configs)
            await session.commit()
            print(f"==> [Seed] Seeded {len(default_configs)} baseline application configurations.")
        else:
            print(f"==> [Seed] Existing {len(configs)} app configurations detected. Skipping config seed.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed StudyMate AI initial Super Admin")
    parser.add_argument("--email", default=os.getenv("ADMIN_EMAIL", "akanmolbhumihar09@gmail.com"))
    parser.add_argument("--password", default=os.getenv("ADMIN_PASSWORD", "Anmol@SINGH"))
    parser.add_argument("--name", default=os.getenv("ADMIN_NAME", "Anmol Singh"))

    args = parser.parse_args()

    if not args.password:
        print("ERROR: Admin password cannot be empty.")
        sys.exit(1)

    asyncio.run(seed_production_database(args.email, args.password, args.name))


if __name__ == "__main__":
    main()
