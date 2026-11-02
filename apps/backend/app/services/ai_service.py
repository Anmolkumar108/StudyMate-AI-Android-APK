import json
import logging
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIService:
    """Configurable AI Gateway supporting streaming chat, topic explanations, and note synthesis."""

    def __init__(
        self,
        provider: str | None = None,
        model_name: str | None = None,
        api_key: str | None = None,
    ) -> None:
        self.provider = provider or settings.PRIMARY_AI_PROVIDER
        self.model_name = model_name or settings.AI_MODEL_NAME
        self.api_key = api_key if api_key is not None else settings.AI_API_KEY

    def _is_mock_key(self) -> bool:
        if not self.api_key:
            return True
        clean = self.api_key.strip().lower()
        return (
            clean in ("mock-dev-key", "your_ai_provider_api_key_here", "none", "")
            or "your_ai" in clean
        )

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        is_socratic: bool = False,
        subject_name: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream conversational tokens with optional Socratic tutoring framing."""
        system_prompt = self._build_chat_system_prompt(is_socratic, subject_name)

        if self._is_mock_key():
            async for chunk in self._stream_mock_response(messages, is_socratic, subject_name):
                yield chunk
            return

        try:
            if self.provider == "gemini":
                async for chunk in self._stream_gemini(system_prompt, messages):
                    yield chunk
            else:
                # Fallback to OpenAI-compatible streaming API
                async for chunk in self._stream_openai_compatible(system_prompt, messages):
                    yield chunk
        except Exception as e:
            logger.warning("AI provider failed during streaming: %s. Falling back to local tutor.", e)
            async for chunk in self._stream_mock_response(messages, is_socratic, subject_name):
                yield chunk

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        is_socratic: bool = False,
        subject_name: str | None = None,
    ) -> str:
        """Non-streaming chat response for mobile clients."""
        parts: list[str] = []
        async for chunk in self.stream_chat(messages, is_socratic, subject_name):
            parts.append(chunk)
        return "".join(parts)

    async def generate_explanation(
        self,
        topic: str,
        depth: Literal["elif", "high_school", "undergraduate", "expert"] = "undergraduate",
        subject_name: str | None = None,
    ) -> dict[str, Any]:
        """Generate structured explanation with takeaways and self-check question."""
        if self._is_mock_key():
            return self._mock_explanation(topic, depth, subject_name)

        prompt = (
            f"Explain the academic topic: '{topic}' at depth: '{depth}'. "
            f"Context Subject: {subject_name or 'General Studies'}.\n"
            "Return valid JSON strictly adhering to schema:\n"
            '{"topic": string, "depth": string, "explanation": string (markdown supported), '
            '"key_takeaways": [string, string, ...], "self_check_question": string}'
        )

        try:
            content = await self._generate_completion(prompt)
            data = self._clean_json_response(content)
            return data
        except Exception as e:
            logger.warning("AI provider failed for explanation, falling back: %s", e)
            return self._mock_explanation(topic, depth, subject_name)

    async def generate_notes(
        self,
        source_text: str,
        note_type: Literal["cornell", "executive", "study_guide"] = "cornell",
        title: str | None = None,
        subject_name: str | None = None,
    ) -> dict[str, Any]:
        """Transform raw text or transcripts into structured study notes."""
        if self._is_mock_key():
            return self._mock_notes(source_text, note_type, title, subject_name)

        prompt = (
            f"Convert the following course material into {note_type.upper()} format study notes.\n"
            f"Subject: {subject_name or 'General Studies'}\n"
            f"Title Suggestion: {title or 'Auto-generated Note'}\n\n"
            f"Source Text:\n{source_text[:15000]}\n\n"
            "Return strictly valid JSON with schema:\n"
            '{"title": string, "note_type": string, "content": string (markdown with KaTeX if math), '
            '"key_points": [string, string, ...], "summary": string}'
        )

        try:
            content = await self._generate_completion(prompt)
            return self._clean_json_response(content)
        except Exception as e:
            logger.warning("AI provider failed for note generation: %s", e)
            return self._mock_notes(source_text, note_type, title, subject_name)

    async def summarize_document(
        self,
        extracted_text: str,
        doc_title: str,
    ) -> dict[str, Any]:
        """Summarize uploaded document into TL;DR, key concepts, and glossary."""
        if self._is_mock_key():
            return self._mock_document_summary(extracted_text, doc_title)

        snippet = extracted_text[:12000]
        prompt = (
            f"Summarize the document '{doc_title}'.\n"
            f"Extracted content:\n{snippet}\n\n"
            "Return valid JSON adhering to:\n"
            '{"summary_tldr": string (concise 3-4 sentence overview), '
            '"summary_key_concepts": [{"concept": string, "explanation": string}, ...], '
            '"page_count_estimate": int}'
        )

        try:
            content = await self._generate_completion(prompt)
            return self._clean_json_response(content)
        except Exception as e:
            logger.warning("AI summary generation failed: %s", e)
            return self._mock_document_summary(extracted_text, doc_title)

    async def generate_quiz_questions(
        self,
        source_text: str,
        question_count: int = 5,
        difficulty: str = "medium",
        subject_name: str | None = None,
    ) -> list[dict[str, Any]]:
        """Generate high-yield exam quiz questions with options and explanations."""
        if self._is_mock_key():
            return self._mock_quiz_questions(source_text, question_count, difficulty, subject_name)

        prompt = (
            f"Generate {question_count} high-yield Multiple Choice Questions (MCQs) for university exam review.\n"
            f"Difficulty: {difficulty}\n"
            f"Subject: {subject_name or 'General Studies'}\n"
            f"Source Material:\n{source_text[:12000]}\n\n"
            "Return valid JSON array of objects adhering strictly to schema:\n"
            '[{"question_text": string, "question_type": "mcq", '
            '"options": [{"key": "A", "text": string}, {"key": "B", "text": string}, {"key": "C", "text": string}, {"key": "D", "text": string}], '
            '"correct_option_key": "A"|"B"|"C"|"D", '
            '"explanation": string (detailed rationale for correct answer)}]'
        )

        try:
            content = await self._generate_completion(prompt)
            data = self._clean_json_response(content)
            if isinstance(data, list) and len(data) > 0:
                return data
            if isinstance(data, dict) and "questions" in data:
                return data["questions"]  # type: ignore[no-any-return]
            return self._mock_quiz_questions(source_text, question_count, difficulty, subject_name)
        except Exception as e:
            logger.warning("AI provider failed for quiz generation: %s", e)
            return self._mock_quiz_questions(source_text, question_count, difficulty, subject_name)

    async def breakdown_task(
        self,
        title: str,
        description: str | None = None,
        estimated_minutes: int | None = None,
    ) -> list[dict[str, Any]]:
        """Break down a large academic task into discrete, actionable subtasks."""
        if self._is_mock_key():
            return self._mock_task_breakdown(title, description, estimated_minutes)

        prompt = (
            f"You are an academic productivity coach. Break down the following college task into 3-6 discrete, sequential subtasks.\n"
            f"Task Title: '{title}'\n"
            f"Description: '{description or 'None provided'}'\n"
            f"Total Estimated Minutes: {estimated_minutes or 'Flexible'}\n\n"
            "Return valid JSON array of objects strictly adhering to:\n"
            '[{"title": string (action-oriented checklist item), "estimated_minutes": int | null}]'
        )
        try:
            content = await self._generate_completion(prompt)
            data = self._clean_json_response(content)
            if isinstance(data, list) and len(data) > 0:
                return data
            if isinstance(data, dict) and "subtasks" in data and isinstance(data["subtasks"], list):
                return data["subtasks"]  # type: ignore[no-any-return]
            return self._mock_task_breakdown(title, description, estimated_minutes)
        except Exception as e:
            logger.warning("AI provider failed for task breakdown: %s", e)
            return self._mock_task_breakdown(title, description, estimated_minutes)

    async def suggest_schedule(
        self,
        tasks: list[dict[str, Any]],
        available_hours_per_day: float = 3.0,
    ) -> dict[str, Any]:
        """Suggest an optimized study schedule based on deadlines, priorities, and available hours."""
        if self._is_mock_key():
            return self._mock_schedule_suggestion(tasks, available_hours_per_day)

        task_summaries = [
            f"- ID: {t.get('id')}, Title: '{t.get('title')}', Priority: {t.get('priority')}, Due: {t.get('due_datetime')}, Est: {t.get('estimated_minutes', 60)} mins"
            for t in tasks[:15]
        ]
        prompt = (
            f"You are an academic planner. Based on the following pending student tasks and an available study budget of {available_hours_per_day} hours/day:\n"
            + "\n".join(task_summaries) + "\n\n"
            "Generate an optimal study allocation plan. Return valid JSON adhering to:\n"
            '{"summary": string (concise strategy overview), '
            '"plan": [{"task_id": string, "task_title": string, "priority": string, "suggested_date": string (YYYY-MM-DD), "suggested_minutes": int, "rationale": string}]}'
        )
        try:
            content = await self._generate_completion(prompt)
            data = self._clean_json_response(content)
            if isinstance(data, dict) and "plan" in data:
                return data
            return self._mock_schedule_suggestion(tasks, available_hours_per_day)
        except Exception as e:
            logger.warning("AI provider failed for schedule suggestion: %s", e)
            return self._mock_schedule_suggestion(tasks, available_hours_per_day)

    async def parse_natural_task(self, prompt_text: str) -> dict[str, Any]:
        """Convert messy natural-language input into structured task draft."""
        if self._is_mock_key():
            return self._mock_parse_natural_task(prompt_text)

        prompt = (
            f"Extract structured college task information from this user prompt: '{prompt_text}'.\n"
            f"Current reference time: {datetime.now(UTC).isoformat()}\n\n"
            "Return valid JSON adhering to:\n"
            '{"title": string (concise), "description": string or null, '
            '"priority": "low"|"medium"|"high"|"urgent", "due_datetime": ISO-8601 string or null, '
            '"estimated_minutes": int or null, "suggested_subtasks": [string, string]}'
        )
        try:
            content = await self._generate_completion(prompt)
            data = self._clean_json_response(content)
            if isinstance(data, dict) and "title" in data:
                return data
            return self._mock_parse_natural_task(prompt_text)
        except Exception as e:
            logger.warning("AI provider failed for natural task parse: %s", e)
            return self._mock_parse_natural_task(prompt_text)

    async def get_daily_briefing(self, tasks: list[dict[str, Any]]) -> dict[str, Any]:
        """Generate a motivating daily briefing highlighting urgent tasks."""
        if self._is_mock_key():
            return self._mock_daily_briefing(tasks)

        task_summaries = [
            f"- Title: '{t.get('title')}', Priority: {t.get('priority')}, Due: {t.get('due_datetime')}"
            for t in tasks[:10]
        ]
        prompt = (
            f"Generate an encouraging daily academic briefing for a student. Pending tasks:\n"
            + "\n".join(task_summaries) + "\n\n"
            "Return valid JSON strictly adhering to:\n"
            '{"date": string (today), "greeting": string, "summary": string (motivational 2 sentences), '
            '"urgent_tasks": [{"id": string, "title": string, "priority": string, "due": string}], '
            '"recommended_focus_order": [string (title), string]}'
        )
        try:
            content = await self._generate_completion(prompt)
            data = self._clean_json_response(content)
            if isinstance(data, dict) and "summary" in data:
                return data
            return self._mock_daily_briefing(tasks)
        except Exception as e:
            logger.warning("AI provider failed for daily briefing: %s", e)
            return self._mock_daily_briefing(tasks)

    def _build_chat_system_prompt(self, is_socratic: bool, subject_name: str | None) -> str:
        base = (
            "You are StudyMate AI, an expert, supportive academic tutor for college students.\n"
            "Format math using KaTeX ($...$ or $$...$$). Use clear markdown headings and bullet points.\n"
        )
        if subject_name:
            base += f"The student is asking questions specifically in the context of the course: '{subject_name}'.\n"

        if is_socratic:
            base += (
                "MODE: SOCRATIC TUTORING.\n"
                "Do NOT directly provide full final solutions or dump completed homework answers.\n"
                "Instead, guide the student step-by-step: ask clarifying questions, provide hints, "
                "encourage critical thinking, and let them arrive at the breakthrough themselves."
            )
        else:
            base += "Provide clear, structured, and pedagogical explanations with worked examples where helpful."
        return base

    async def _stream_gemini(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
    ) -> AsyncGenerator[str, None]:
        """Stream from Gemini API using REST SSE streaming."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:streamGenerateContent?alt=sse&key={self.api_key}"

        contents = []
        for m in messages:
            role = "user" if m.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [{"text": m.get("content", "")}]})

        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": contents,
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 2048},
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    yield f"Error from AI provider ({response.status_code}). Please try again."
                    return

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    try:
                        chunk_json = json.loads(data_str)
                        candidates = chunk_json.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            for p in parts:
                                if "text" in p:
                                    yield p["text"]
                    except Exception:
                        continue

    async def _stream_openai_compatible(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
    ) -> AsyncGenerator[str, None]:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        formatted_msgs = [{"role": "system", "content": system_prompt}] + messages

        payload = {
            "model": self.model_name,
            "messages": formatted_msgs,
            "stream": True,
            "temperature": 0.4,
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                if response.status_code != 200:
                    yield f"Error from AI provider ({response.status_code})."
                    return

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk_json = json.loads(data_str)
                        choices = chunk_json.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            if "content" in delta:
                                yield delta["content"]
                    except Exception:
                        continue

    async def _generate_completion(self, prompt: str) -> str:
        """Single-shot completion for structured tasks."""
        if self.provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json",
                },
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload)
                res.raise_for_status()
                data = res.json()
                return str(data["candidates"][0]["content"]["parts"][0]["text"])
        else:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {self.api_key}"}
            payload = {
                "model": self.model_name,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                res.raise_for_status()
                data = res.json()
                return str(data["choices"][0]["message"]["content"])

    def _clean_json_response(self, text: str) -> dict[str, Any]:
        clean = text.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        if clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        return json.loads(clean.strip())  # type: ignore[no-any-return]

    # --- Offline & Testing Mock Fallbacks ---

    async def _stream_mock_response(
        self,
        messages: list[dict[str, str]],
        is_socratic: bool,
        subject_name: str | None,
    ) -> AsyncGenerator[str, None]:
        user_query = messages[-1].get("content", "").strip() if messages else "your study topic"
        q_lower = user_query.lower()
        context_str = f" in {subject_name}" if subject_name else ""

        # 1. Identity & Name questions
        if any(w in q_lower for w in ["tumhara name", "tumhara naam", "who are you", "kaun ho", "naam kya hai", "name kya hai", "what is your name"]):
            chunks = [
                "Mera naam **StudyMate AI** hai! Main aapka 24/7 personal AI study tutor aur academic assistant hoon.\n\n",
                "Main aapki padhai se judi sabhi zarooraton me madad karta hoon:\n",
                "- **Concept Clarification**: Kisi bhi tough topic ko simple bhasha me samjhana\n",
                "- **Cornell Notes & Summaries**: Lecture notes aur course PDFs se summary banana\n",
                "- **Doubt Solving**: Step-by-step solutions explain karna\n",
                "- **Active Recall**: Quizzes aur Spaced Repetition Flashcards se revision karwana\n\n",
                "Aap mujhse kisi bhi subject ya topic ke baare me poochh sakte hain. Aaj hum kya padhenge?",
            ]
        # 2. Greetings
        elif q_lower in ["hello", "hi", "hey", "namaste", "pranam", "kya haal hai", "good morning", "good evening"]:
            chunks = [
                "Namaste! Main **StudyMate AI** study tutor hoon.\n\n",
                "Aaj aapki padhai me main kya madad kar sakta hoon? ",
                "Aap koi specific subject ka question poochh sakte hain, kisi formula ka derivation samajh sakte hain, ya practice quiz generate karwa sakte hain.",
            ]
        # 3. Networking TCP vs UDP
        elif "tcp" in q_lower and "udp" in q_lower:
            chunks = [
                "### TCP vs UDP — Key Differences for Exams\n\n",
                "| Feature | TCP (Transmission Control Protocol) | UDP (User Datagram Protocol) |\n",
                "| :--- | :--- | :--- |\n",
                "| **Connection** | Connection-Oriented (3-way handshake) | Connectionless |\n",
                "| **Reliability** | Guaranteed delivery (ACK, retransmission) | Best-effort (packets may be lost) |\n",
                "| **Ordering** | In-order delivery guaranteed | No ordering guarantee |\n",
                "| **Speed** | Slower (overhead due to checks) | Very fast & low latency |\n",
                "| **Use Cases** | Web (HTTP/HTTPS), Email, File Transfer | Live streaming, Online Gaming, VoIP |\n\n",
                "**Exam Tip**: *TCP = Accuracy & Order*, *UDP = Speed & Real-time*.",
            ]
        # 4. Socratic Tutoring Mode
        elif is_socratic:
            chunks = [
                f"That's a great question about **{user_query}**{context_str}!\n\n",
                "In Socratic mode, let's break it down together step-by-step:\n",
                "1. What is the core definition or starting principle that applies here first?\n",
                "2. If you change the primary variable or condition, what outcome do you predict?\n\n",
                "*Hint: Think about the underlying mechanism rather than just the final answer.* What do you think?",
            ]
        # 5. General Academic Explanation
        else:
            chunks = [
                f"### Understanding: {user_query}{context_str}\n\n",
                "Here is the structured breakdown for your study:\n\n",
                f"1. **Core Concept**: **{user_query}** is a key principle in this subject domain.\n",
                "2. **Mechanism**: It operates by taking defined inputs and processing them through standard rules to yield consistent results.\n",
                "3. **Practical Application**: Frequently tested in exam questions and real-world system designs.\n\n",
                "**Pro-Tip**: Tap **'📝 Save Note'** below to save this explanation directly into your Study Notes library!",
            ]

        for chunk in chunks:
            yield chunk

    def _mock_explanation(
        self,
        topic: str,
        depth: str,
        subject_name: str | None,
    ) -> dict[str, Any]:
        depth_titles = {
            "elif": "Like You're 5 (Feynman Technique)",
            "high_school": "High School Foundations",
            "undergraduate": "Undergraduate Academic Rigor",
            "expert": "Advanced Technical Specification",
        }
        return {
            "topic": topic,
            "depth": depth,
            "explanation": (
                f"### {topic} — {depth_titles.get(depth, depth.capitalize())}\n\n"
                f"Imagine **{topic}** as an organized system where inputs systematically transform into outputs. "
                "In academic study, mastering this concept requires understanding the underlying mechanism rather than rote memorization.\n\n"
                "#### Conceptual Breakdown:\n"
                "1. **Foundational Rule**: Governs state transitions.\n"
                "2. **Boundary Conditions**: Where the principle holds and where edge-cases occur.\n"
                "3. **Practical Application**: Real-world implementation in modern practice."
            ),
            "key_takeaways": [
                f"Core mechanism of {topic} is deterministic and structured.",
                "Always check edge constraints before applying generalized rules.",
                "Review this using spaced repetition within 24 hours.",
            ],
            "self_check_question": f"In your own words, what is the single most critical factor in {topic}?",
        }

    def _mock_notes(
        self,
        source_text: str,
        note_type: str,
        title: str | None,
        subject_name: str | None,
    ) -> dict[str, Any]:
        derived_title = title or (source_text[:30].strip() + "...")
        return {
            "title": derived_title,
            "note_type": note_type,
            "content": (
                f"# {derived_title}\n\n"
                f"**Subject**: {subject_name or 'General Studies'}  \n"
                f"**Format**: {note_type.title()} Notes\n\n"
                "## Cues & Questions\n"
                "- What are the fundamental assumptions?\n"
                "- How do these components link together?\n\n"
                "## Notes\n"
                f"{source_text[:500]}...\n\n"
                "## Summary\n"
                "These notes encapsulate key principles for active review and exam preparation."
            ),
            "key_points": [
                "Fundamental definitions established.",
                "Core relationship between variables synthesized.",
                "Review interval: 3 days.",
            ],
            "summary": "Concise synthesis of lecture concepts ready for spaced repetition review.",
        }

    def _mock_document_summary(
        self,
        extracted_text: str,
        doc_title: str,
    ) -> dict[str, Any]:
        snippet = extracted_text[:200] if extracted_text else "Course reading material."
        return {
            "summary_tldr": (
                f"This document '{doc_title}' covers core principles and structural methodologies. "
                f"Key discussion revolves around: {snippet.strip()}... "
                "It serves as essential reference material for upcoming exams."
            ),
            "summary_key_concepts": [
                {
                    "concept": "Foundational Overview",
                    "explanation": "Introduces primary terminology and analytical framework.",
                },
                {
                    "concept": "Methodological Steps",
                    "explanation": "Details the phased approach to solving relevant problem sets.",
                },
                {
                    "concept": "Critical Takeaway",
                    "explanation": "Emphasizes practical constraints and exam-tested formulas.",
                },
            ],
            "page_count_estimate": max(1, len(extracted_text) // 2000),
        }

    def _mock_quiz_questions(
        self,
        source_text: str,
        question_count: int,
        difficulty: str,
        subject_name: str | None,
    ) -> list[dict[str, Any]]:
        text_lower = source_text.lower()
        questions: list[dict[str, Any]] = []

        # Question template 1: Foundational concept
        questions.append({
            "question_text": f"Which of the following best characterizes the primary principle of {source_text[:30].strip()}?",
            "question_type": "mcq",
            "options": [
                {"key": "A", "text": "Deterministic transition based on defined system state"},
                {"key": "B", "text": "Unbounded arbitrary execution without state constraints"},
                {"key": "C", "text": "Exclusive hardware-only dependency without abstraction"},
                {"key": "D", "text": "Purely random selection without underlying rules"},
            ],
            "correct_option_key": "A",
            "explanation": "Option A is correct because academic models operate under deterministic transition boundaries rather than random selection.",
        })

        # Question template 2: Efficiency / Complexity
        questions.append({
            "question_text": "What is the primary constraint to evaluate when analyzing time and memory trade-offs?",
            "question_type": "mcq",
            "options": [
                {"key": "A", "text": "Only the physical screen resolution"},
                {"key": "B", "text": "Asymptotic bounds (Big-O) relative to input size N"},
                {"key": "C", "text": "Color theme formatting parameters"},
                {"key": "D", "text": "Font size variations in notes"},
            ],
            "correct_option_key": "B",
            "explanation": "Option B is correct because asymptotic notation measures algorithmic complexity independently of hardware specifics.",
        })

        # Question template 3: TCP vs UDP (if networking mentioned)
        if "tcp" in text_lower or "udp" in text_lower or "network" in text_lower:
            questions.append({
                "question_text": "Why is UDP preferred over TCP for live video broadcasting and online gaming?",
                "question_type": "mcq",
                "options": [
                    {"key": "A", "text": "UDP guarantees zero packet loss"},
                    {"key": "B", "text": "UDP has lower latency because it does not require 3-way handshake or ACKs"},
                    {"key": "C", "text": "UDP encrypts data by default"},
                    {"key": "D", "text": "UDP uses larger packet headers than TCP"},
                ],
                "correct_option_key": "B",
                "explanation": "Option B is correct: UDP avoids acknowledgment round-trips, making it optimal for real-time latency-sensitive streams.",
            })

        # Question template 4: Memory / Storage
        questions.append({
            "question_text": "In spaced repetition systems (e.g. SuperMemo SM-2), what determines the next review interval?",
            "question_type": "mcq",
            "options": [
                {"key": "A", "text": "Random system clock selection"},
                {"key": "B", "text": "Student performance rating (1-4) combined with current Ease Factor"},
                {"key": "C", "text": "The length of the card's question text"},
                {"key": "D", "text": "The number of total decks in the app"},
            ],
            "correct_option_key": "B",
            "explanation": "Option B is correct: SM-2 dynamically computes interval growth based on recall difficulty ratings.",
        })

        # Question template 5: Methodology
        questions.append({
            "question_text": "What is the primary pedagogical benefit of the Feynman Technique?",
            "question_type": "mcq",
            "options": [
                {"key": "A", "text": "Rote memorization through repeated copying"},
                {"key": "B", "text": "Explaining complex concepts in plain language to expose knowledge gaps"},
                {"key": "C", "text": "Skipping conceptual reading to guess exam answers"},
                {"key": "D", "text": "Using overly dense academic jargon"},
            ],
            "correct_option_key": "B",
            "explanation": "Option B is correct: Teaching or explaining in simple terms immediately reveals where deep comprehension is lacking.",
        })

        # Pad or slice to match requested question_count
        while len(questions) < question_count:
            idx = len(questions) + 1
            questions.append({
                "question_text": f"Review question #{idx}: Which analytical approach ensures comprehensive exam mastery?",
                "question_type": "mcq",
                "options": [
                    {"key": "A", "text": "Active Recall and Self-Testing"},
                    {"key": "B", "text": "Passive re-reading of slides without questioning"},
                    {"key": "C", "text": "Cramming the night before exam without sleep"},
                    {"key": "D", "text": "Ignoring past exam questions"},
                ],
                "correct_option_key": "A",
                "explanation": "Option A is correct: Active testing forces cognitive retrieval, building durable neural pathways.",
            })

        return questions[:question_count]

    def _mock_task_breakdown(
        self,
        title: str,
        description: str | None,
        estimated_minutes: int | None,
    ) -> list[dict[str, Any]]:
        title_lower = title.lower()
        if any(w in title_lower for w in ["essay", "paper", "report", "assignment"]):
            return [
                {"title": "Review prompt guidelines, rubric, and citation requirements", "estimated_minutes": 25},
                {"title": "Outline structure: thesis, main arguments, and supporting evidence", "estimated_minutes": 40},
                {"title": "Draft core body paragraphs and integrate source references", "estimated_minutes": 75},
                {"title": "Proofread, verify citations, and export final submission", "estimated_minutes": 30},
            ]
        elif any(w in title_lower for w in ["exam", "test", "midterm", "final", "quiz"]):
            return [
                {"title": "Review lecture slides and key concept summaries", "estimated_minutes": 45},
                {"title": "Practice active recall with SM-2 flashcard deck", "estimated_minutes": 35},
                {"title": "Work through 2-3 practice problem sets or mock quiz questions", "estimated_minutes": 60},
                {"title": "Clarify remaining doubts on difficult topics", "estimated_minutes": 30},
            ]
        elif any(w in title_lower for w in ["project", "code", "app", "lab"]):
            return [
                {"title": "Review lab/project specifications and setup environment", "estimated_minutes": 30},
                {"title": "Implement core logic and functional requirements", "estimated_minutes": 90},
                {"title": "Run test cases and verify edge cases", "estimated_minutes": 45},
                {"title": "Document findings and push code/submit report", "estimated_minutes": 25},
            ]
        else:
            return [
                {"title": "Gather syllabus, lecture notes, and required materials", "estimated_minutes": 20},
                {"title": "Execute primary task objectives and draft solutions", "estimated_minutes": 60},
                {"title": "Review work against assignment instructions and finalize", "estimated_minutes": 25},
            ]

    def _mock_schedule_suggestion(
        self,
        tasks: list[dict[str, Any]],
        available_hours_per_day: float,
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        plan: list[dict[str, Any]] = []
        priority_weights = {"urgent": 4, "high": 3, "medium": 2, "low": 1}
        sorted_tasks = sorted(
            tasks,
            key=lambda t: priority_weights.get(str(t.get("priority", "medium")).lower(), 2),
            reverse=True,
        )

        for i, t in enumerate(sorted_tasks[:7]):
            day_offset = i // 2
            plan_date = (now + timedelta(days=day_offset)).strftime("%Y-%m-%d")
            est = t.get("estimated_minutes") or 45
            plan.append({
                "task_id": str(t.get("id")),
                "task_title": str(t.get("title")),
                "priority": str(t.get("priority", "medium")),
                "suggested_date": plan_date,
                "suggested_minutes": min(est, int(available_hours_per_day * 60)),
                "rationale": f"Prioritized for Day +{day_offset} based on urgency level and balanced study load.",
            })

        return {
            "summary": f"Allocated top {len(plan)} tasks across your available daily budget of {available_hours_per_day} hours, placing high-urgency items first.",
            "plan": plan,
        }

    def _mock_parse_natural_task(self, prompt_text: str) -> dict[str, Any]:
        prompt_lower = prompt_text.lower()
        priority = "medium"
        if any(w in prompt_lower for w in ["urgent", "asap", "tomorrow", "tonight", "important"]):
            priority = "urgent" if "urgent" in prompt_lower or "asap" in prompt_lower else "high"
        elif "low" in prompt_lower:
            priority = "low"

        est_minutes = 60
        if "hour" in prompt_lower or "hr" in prompt_lower:
            est_minutes = 120 if "2" in prompt_lower else 60
        elif "min" in prompt_lower:
            est_minutes = 30

        due = datetime.now(UTC) + timedelta(days=2)
        title = prompt_text.strip()
        if len(title) > 60:
            title = title[:60] + "..."

        return {
            "title": title,
            "description": f"Drafted from natural prompt: '{prompt_text}'",
            "priority": priority,
            "due_datetime": due.isoformat(),
            "estimated_minutes": est_minutes,
            "suggested_subtasks": [
                "Review prerequisites and instructions",
                "Work on main deliverable",
                "Review and submit",
            ],
        }

    def _mock_daily_briefing(self, tasks: list[dict[str, Any]]) -> dict[str, Any]:
        today_str = datetime.now(UTC).strftime("%A, %B %d")
        urgent = [
            {"id": str(t.get("id")), "title": str(t.get("title")), "priority": str(t.get("priority")), "due": str(t.get("due_datetime", "Today"))}
            for t in tasks
            if str(t.get("priority")).lower() in ("urgent", "high")
        ][:3]

        order = [str(t.get("title")) for t in tasks[:4]]

        return {
            "date": today_str,
            "greeting": "Good day, Scholar! Let's conquer today's study goals.",
            "summary": f"You have {len(tasks)} pending tasks in total with {len(urgent)} requiring immediate focus. Maintain consistent momentum with focused Pomodoro blocks.",
            "urgent_tasks": urgent,
            "recommended_focus_order": order if order else ["Review today's notes", "Plan tomorrow's schedule"],
        }

