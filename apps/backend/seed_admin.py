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

        # 1.1 Ensure active Student test account exists for mobile OTP & password recovery
        dev_email = "devlopersingh6@gmail.com"
        stmt_dev = select(User).where(User.email == dev_email)
        res_dev = await session.execute(stmt_dev)
        dev_user = res_dev.scalar_one_or_none()
        if not dev_user:
            print(f"==> [Seed] Seeding student account '{dev_email}'...")
            new_student = User(
                id=uuid.uuid4(),
                email=dev_email,
                hashed_password=hash_password("Dev@Singh2026"),
                full_name="Developer Singh",
                role=UserRole.STUDENT,
                status=UserStatus.ACTIVE,
                token_version=1,
                created_at=now,
                updated_at=now,
            )
            session.add(new_student)
            await session.commit()
            print(f"==> [Seed] Student account '{dev_email}' successfully seeded!")

        # 2. Seed baseline App Configurations & Feature Flags
        stmt_configs = select(AppConfig)
        res_configs = await session.execute(stmt_configs)
        existing_keys = {c.key for c in res_configs.scalars().all()}

        baseline_configs = [
            AppConfig(
                id=uuid.uuid4(),
                key="subscription_tiers",
                value=[
                    {
                        "tier_id": "free",
                        "name": "Student Standard",
                        "price_inr": 0,
                        "features": ["100 Notes", "5 Subjects", "50 Daily AI Queries", "Basic Pomodoro"],
                    },
                    {
                        "tier_id": "pro",
                        "name": "StudyMate Pro",
                        "price_inr": 199,
                        "features": [
                            "Unlimited Notes",
                            "Unlimited Subjects",
                            "500 Daily AI Queries",
                            "Exam Predictor",
                            "Priority AI Model",
                        ],
                    },
                ],
                category="monetization",
                description="Platform subscription plans, pricing in INR, and quotas",
                updated_at=now,
            ),
            AppConfig(
                id=uuid.uuid4(),
                key="monetization_gate_active",
                value=False,
                category="monetization",
                description="Master switch for student payment gate (False = 100% free mode)",
                updated_at=now,
            ),
            AppConfig(
                id=uuid.uuid4(),
                key="min_app_version",
                value={
                    "version": "1.0.0",
                    "force_update": False,
                    "store_url": "https://play.google.com/store/apps/details?id=com.studymate.ai",
                },
                category="remote_config",
                description="Minimum supported Android version and Play Store gate",
                updated_at=now,
            ),
            AppConfig(
                id=uuid.uuid4(),
                key="feature_flags",
                value={
                    "ai_chat_enabled": True,
                    "pomodoro_timer_enabled": True,
                    "curated_curriculum_enabled": True,
                    "quiz_generator_enabled": True,
                    "gdpr_export_enabled": True,
                },
                category="features",
                description="Dynamic student feature killswitch toggles",
                updated_at=now,
            ),
            AppConfig(
                id=uuid.uuid4(),
                key="ai_limits_config",
                value={
                    "daily_free_tier_queries": 50,
                    "daily_pro_tier_queries": 500,
                    "max_tokens_per_request": 4096,
                    "temperature": 0.7,
                },
                category="ai_governance",
                description="AI query quotas, token limits, and LLM hyperparameters",
                updated_at=now,
            ),
            AppConfig(
                id=uuid.uuid4(),
                key="ai_model_name",
                value="gemini-3.1-flash-lite",
                category="ai_governance",
                description="Active primary AI model architecture",
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
                key="feature_pomodoro_ambient_sound",
                value=True,
                category="features",
                description="Enable high-fidelity binaural ambient background sound in Pomodoro timer",
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

        to_add = [c for c in baseline_configs if c.key not in existing_keys]
        if to_add:
            session.add_all(to_add)
            await session.commit()
            print(f"==> [Seed] Seeded {len(to_add)} missing application configurations.")
        else:
            print(f"==> [Seed] All application configurations already present.")

        # 3. Seed sample Support Tickets if empty
        from app.models.support_ticket import SupportTicket, TicketCategory, TicketPriority, TicketStatus
        stmt_tickets = select(SupportTicket)
        res_tickets = await session.execute(stmt_tickets)
        existing_tickets = res_tickets.scalars().all()

        if not existing_tickets and dev_user:
            print("==> [Seed] Seeding sample support tickets...")
            welcome_tickets = [
                SupportTicket(
                    id=uuid.uuid4(),
                    ticket_number="SM-TICK-1001",
                    user_id=dev_user.id,
                    subject="Welcome to StudyMate AI Support Desk",
                    category=TicketCategory.ACCOUNT_ISSUE,
                    priority=TicketPriority.LOW,
                    status=TicketStatus.RESOLVED,
                    description="Automated system onboarding ticket. Support desk SLA monitoring is active.",
                    admin_notes="Account successfully created and validated by automated system.",
                    resolution_summary="Ticket resolved on student account setup.",
                    created_at=now,
                    updated_at=now,
                    resolved_at=now,
                ),
                SupportTicket(
                    id=uuid.uuid4(),
                    ticket_number="SM-TICK-1002",
                    user_id=dev_user.id,
                    subject="Offline study mode and flashcard caching request",
                    category=TicketCategory.FEATURE_REQUEST,
                    priority=TicketPriority.MEDIUM,
                    status=TicketStatus.OPEN,
                    description="Requesting ability to review flashcards and Cornell notes during campus commute without active internet.",
                    created_at=now,
                    updated_at=now,
                ),
            ]
            session.add_all(welcome_tickets)
            await session.commit()
            print(f"==> [Seed] Seeded {len(welcome_tickets)} baseline support tickets.")


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

