import uuid
from typing import Any, Sequence

from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subject_template import SubjectTemplate

# Verified Standard University Starter Curriculum Templates
DEFAULT_UNIVERSITY_TEMPLATES: list[dict[str, Any]] = [
    {
        "name": "Data Structures & Algorithms",
        "code": "CS-201",
        "category": "Computer Science",
        "description": "Comprehensive study of arrays, linked lists, trees, graphs, sorting, searching, dynamic programming, and algorithmic complexity (Big-O).",
        "color": "#6366F1",
        "credits": 4,
        "difficulty_level": "intermediate",
        "suggested_units": [
            {"title": "Unit 1: Linear Structures (Arrays, Stacks, Queues, Linked Lists)", "weeks": 3},
            {"title": "Unit 2: Trees & Binary Search Trees (BST, AVL)", "weeks": 3},
            {"title": "Unit 3: Graphs & Graph Traversal (BFS, DFS, Dijkstra)", "weeks": 3},
            {"title": "Unit 4: Dynamic Programming & Greedy Algorithms", "weeks": 3},
            {"title": "Unit 5: Advanced Sorting, Hashing & String Matching", "weeks": 2},
        ],
    },
    {
        "name": "Database Management Systems",
        "code": "CS-302",
        "category": "Computer Science",
        "description": "Relational algebra, SQL mastery, ACID properties, normalization (1NF-BCNF), indexing (B-Trees), and distributed transaction management.",
        "color": "#0EA5E9",
        "credits": 3,
        "difficulty_level": "intermediate",
        "suggested_units": [
            {"title": "Unit 1: ER Modeling & Relational Model", "weeks": 2},
            {"title": "Unit 2: Advanced SQL & Complex Queries", "weeks": 3},
            {"title": "Unit 3: Normalization & Schema Refinement", "weeks": 3},
            {"title": "Unit 4: Transaction Processing & Concurrency Control", "weeks": 3},
            {"title": "Unit 5: Indexing, B-Trees & Query Optimization", "weeks": 3},
        ],
    },
    {
        "name": "Machine Learning & AI Foundations",
        "code": "AI-401",
        "category": "Artificial Intelligence",
        "description": "Supervised, unsupervised, and deep learning architectures, gradient descent, neural networks, and model evaluation metrics.",
        "color": "#8B5CF6",
        "credits": 4,
        "difficulty_level": "advanced",
        "suggested_units": [
            {"title": "Unit 1: Statistical Learning Foundations & Regression", "weeks": 3},
            {"title": "Unit 2: Classification (SVM, Logistic Regression, Trees)", "weeks": 3},
            {"title": "Unit 3: Neural Networks & Backpropagation", "weeks": 3},
            {"title": "Unit 4: Unsupervised Learning & Dimensionality Reduction (PCA)", "weeks": 2},
            {"title": "Unit 5: Convolutional & Recurrent Architectures (CNN/RNN/Transformers)", "weeks": 3},
        ],
    },
    {
        "name": "Calculus & Linear Algebra",
        "code": "MATH-101",
        "category": "Mathematics",
        "description": "Derivatives, integrals, multivariable optimization, vector spaces, eigenvalues, eigenvectors, and matrix transformations.",
        "color": "#10B981",
        "credits": 4,
        "difficulty_level": "intermediate",
        "suggested_units": [
            {"title": "Unit 1: Limits, Continuity & Differential Calculus", "weeks": 3},
            {"title": "Unit 2: Integral Calculus & Techniques of Integration", "weeks": 3},
            {"title": "Unit 3: Multivariable Calculus & Partial Derivatives", "weeks": 3},
            {"title": "Unit 4: Matrix Algebra, Determinants & Vector Spaces", "weeks": 3},
            {"title": "Unit 5: Eigenvalues, Eigenvectors & Diagonalization", "weeks": 2},
        ],
    },
    {
        "name": "Organic Chemistry I",
        "code": "CHEM-210",
        "category": "Natural Sciences",
        "description": "Structure and bonding, stereochemistry, reaction mechanisms (SN1, SN2, E1, E2), functional group transformations, and spectroscopy.",
        "color": "#F59E0B",
        "credits": 4,
        "difficulty_level": "advanced",
        "suggested_units": [
            {"title": "Unit 1: Structure, Bonding & Molecular Geometry", "weeks": 2},
            {"title": "Unit 2: Stereochemistry & Chirality", "weeks": 3},
            {"title": "Unit 3: Nucleophilic Substitution (SN1/SN2) & Elimination (E1/E2)", "weeks": 4},
            {"title": "Unit 4: Alkenes, Alkynes & Addition Reactions", "weeks": 3},
            {"title": "Unit 5: Infrared (IR) & NMR Spectroscopy", "weeks": 2},
        ],
    },
    {
        "name": "Microeconomics & Business Principles",
        "code": "ECON-101",
        "category": "Business & Economics",
        "description": "Supply and demand dynamics, consumer choice theory, market structures (competition to monopoly), game theory, and market failure.",
        "color": "#EC4899",
        "credits": 3,
        "difficulty_level": "beginner",
        "suggested_units": [
            {"title": "Unit 1: Scarcity, Trade-offs & Opportunity Cost", "weeks": 2},
            {"title": "Unit 2: Supply, Demand & Market Equilibrium", "weeks": 3},
            {"title": "Unit 3: Elasticity & Consumer Welfare", "weeks": 3},
            {"title": "Unit 4: Production Costs & Perfect Competition", "weeks": 3},
            {"title": "Unit 5: Monopoly, Oligopoly & Game Theory", "weeks": 3},
        ],
    },
]


class SubjectTemplateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        name: str,
        category: str = "General",
        code: str | None = None,
        description: str | None = None,
        color: str = "#6366F1",
        credits: int = 3,
        difficulty_level: str = "intermediate",
        suggested_units: list[dict[str, Any]] | None = None,
        created_by: uuid.UUID | None = None,
        is_active: bool = True,
    ) -> SubjectTemplate:
        template = SubjectTemplate(
            name=name,
            code=code,
            category=category,
            description=description,
            color=color,
            credits=credits,
            difficulty_level=difficulty_level,
            suggested_units=suggested_units or [],
            created_by=created_by,
            is_active=is_active,
        )
        self.session.add(template)
        await self.session.flush()
        await self.session.refresh(template)
        return template

    async def get_by_id(self, template_id: uuid.UUID) -> SubjectTemplate | None:
        stmt = select(SubjectTemplate).where(SubjectTemplate.id == template_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(
        self,
        category: str | None = None,
        active_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[Sequence[SubjectTemplate], int]:
        stmt = select(SubjectTemplate)
        count_stmt = select(func.count(SubjectTemplate.id))

        if category:
            stmt = stmt.where(SubjectTemplate.category == category)
            count_stmt = count_stmt.where(SubjectTemplate.category == category)

        if active_only:
            stmt = stmt.where(SubjectTemplate.is_active.is_(True))
            count_stmt = count_stmt.where(SubjectTemplate.is_active.is_(True))

        total = (await self.session.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(desc(SubjectTemplate.enrolled_count), SubjectTemplate.name).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all(), total

    async def list_categories(self) -> list[str]:
        stmt = (
            select(SubjectTemplate.category)
            .where(SubjectTemplate.is_active.is_(True))
            .distinct()
            .order_by(SubjectTemplate.category)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update(
        self,
        template_id: uuid.UUID,
        **kwargs: Any,
    ) -> SubjectTemplate | None:
        template = await self.get_by_id(template_id)
        if not template:
            return None

        for key, value in kwargs.items():
            if hasattr(template, key) and value is not None:
                setattr(template, key, value)

        await self.session.flush()
        await self.session.refresh(template)
        return template

    async def delete(self, template_id: uuid.UUID) -> bool:
        stmt = delete(SubjectTemplate).where(SubjectTemplate.id == template_id)
        result = await self.session.execute(stmt)
        return (result.rowcount or 0) > 0

    async def increment_enrolled(self, template_id: uuid.UUID) -> SubjectTemplate | None:
        template = await self.get_by_id(template_id)
        if template:
            template.enrolled_count += 1
            await self.session.flush()
            await self.session.refresh(template)
        return template

    async def seed_defaults(self, creator_id: uuid.UUID | None = None) -> list[SubjectTemplate]:
        # Check if templates already exist
        stmt = select(func.count(SubjectTemplate.id))
        count = (await self.session.execute(stmt)).scalar() or 0
        if count > 0:
            # Already seeded
            return []

        created_templates: list[SubjectTemplate] = []
        for item in DEFAULT_UNIVERSITY_TEMPLATES:
            template = SubjectTemplate(
                name=item["name"],
                code=item["code"],
                category=item["category"],
                description=item["description"],
                color=item["color"],
                credits=item["credits"],
                difficulty_level=item["difficulty_level"],
                suggested_units=item["suggested_units"],
                created_by=creator_id,
                is_active=True,
                enrolled_count=0,
            )
            self.session.add(template)
            created_templates.append(template)

        await self.session.flush()
        for t in created_templates:
            await self.session.refresh(t)
        return created_templates

