import json
import logging
import re
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIService:
    """Configurable AI Gateway supporting streaming chat, topic explanations, and note synthesis.

    Seamlessly integrates with Google Gemini REST API (v1beta) and OpenAI-compatible endpoints,
    featuring an expansive academic tutoring engine for offline, low-connectivity, or pre-configured environments.
    """

    def __init__(
        self,
        provider: str | None = None,
        model_name: str | None = None,
        api_key: str | None = None,
    ) -> None:
        self.provider = (provider or settings.PRIMARY_AI_PROVIDER).strip().lower()
        self.model_name = (model_name or settings.AI_MODEL_NAME).strip()
        self.api_key = api_key if api_key is not None else settings.AI_API_KEY

    def _resolve_gemini_model_name(self) -> str:
        """Normalizes model aliases to valid, currently active Google Gemini API identifiers."""
        raw = (self.model_name or "gemini-3.1-flash-lite").strip()
        lower = raw.lower()
        # Default to verified working Google Gemini 3.1 Flash-Lite
        if "1.5" in lower or "2.5" in lower or not raw or "flash-lite" in lower:
            return "gemini-3.1-flash-lite"
        return raw

    def _is_mock_key(self) -> bool:
        if not self.api_key:
            return True
        clean = self.api_key.strip().lower()
        return (
            clean in ("mock-dev-key", "your_ai_provider_api_key_here", "none", "", "test-key")
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
            logger.warning(
                "AI provider '%s' failed during streaming (%s). Gracefully falling back to StudyMate academic engine.",
                self.provider,
                e,
            )
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
            '{"topic": string, "depth": string, "explanation": string (markdown supported with KaTeX math if relevant), '
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
            "Generate an encouraging daily academic briefing for a student. Pending tasks:\n"
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
            "You are StudyMate AI, a universal academic mentor and personal tutor for students across ALL disciplines and levels: "
            "School (K-12, Class 9-12), Sciences (Physics, Chemistry, Biology), Mathematics, Commerce & Economics, "
            "Humanities, History, Civics, Geography, English & Literature, and Engineering/Computer Science.\n"
            "Your mission is to make learning crystal clear, deeply intuitive, and exam-ready for EVERY student.\n"
            "- Adapt to the student's field: Never assume every student is in Computer Science or Engineering. "
            "If asked a Biology question (e.g. photosynthesis, cells, human anatomy), answer with biological processes, functions, and key terms. "
            "If asked History or Civics (e.g. Indian Constitution, revolutions, democracy), provide historical context, articles, dates, and significance. "
            "If asked Commerce or Economics (e.g. demand/supply, accounting, inflation, balance sheets), provide economic logic and financial principles. "
            "If asked Chemistry (e.g. periodic table, chemical bonds, reactions), provide clear chemical equations, valence, and atomic concepts. "
            "If asked School-level science or math, explain with simple, relatable everyday analogies suitable for school students.\n"
            "- Language: You are bilingual in English and Hindi/Hinglish. If the student asks in Hindi or Hinglish (e.g., 'kya hota hai', 'samjhao'), reply in friendly, articulate Hinglish using standard academic terms.\n"
            "- Mathematical formatting: Always format mathematical and scientific equations using KaTeX syntax ($...$ for inline, $$...$$ on a separate line for block equations).\n"
            "- Structural clarity: Break down complex topics into: 1) 💡 Intuition & Core Concept, 2) 🔍 Detailed Explanation & Key Rules, 3) 🎯 Real-life Example or Analogy, 4) 📝 Key Exam Takeaway.\n"
        )
        if subject_name:
            base += f"\nActive Course Context: '{subject_name}'. Tailor your depth and terminology to this academic syllabus.\n"

        if is_socratic:
            base += (
                "\nMODE: SOCRATIC TUTORING.\n"
                "Do NOT dump full solutions or direct answers immediately.\n"
                "Instead, guide the student step-by-step: acknowledge their query, highlight the starting principle or variable, "
                "give a targeted hint, and ask a guiding question that empowers them to deduce the answer themselves."
            )
        else:
            base += "\nProvide thorough, pedagogical explanations with rich examples, formulas, and actionable exam insights."
        return base

    async def _stream_gemini(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
    ) -> AsyncGenerator[str, None]:
        """Stream from Gemini API using REST SSE streaming."""
        model = self._resolve_gemini_model_name()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={self.api_key}"

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
                    error_text = await response.aread()
                    logger.warning(
                        "Gemini API returned status %d: %s. Falling back to local tutor.",
                        response.status_code,
                        error_text.decode(errors="ignore"),
                    )
                    raise RuntimeError(f"Gemini API HTTP {response.status_code}")

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
            async with client.stream("POST", url, json=payload) as response:
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
            model = self._resolve_gemini_model_name()
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
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
        clean = clean.removeprefix("```json")
        clean = clean.removeprefix("```")
        clean = clean.removesuffix("```")
        return json.loads(clean.strip())  # type: ignore[no-any-return]

    # --- Expansive Academic Knowledge & Tutoring Engine ---

    async def _stream_mock_response(
        self,
        messages: list[dict[str, str]],
        is_socratic: bool,
        subject_name: str | None,
    ) -> AsyncGenerator[str, None]:
        user_query = messages[-1].get("content", "").strip() if messages else "your study topic"
        q_lower = user_query.lower()
        context_str = f" in **{subject_name}**" if subject_name else ""

        # 1. Identity & Name questions
        if any(w in q_lower for w in ["tumhara name", "tumhara naam", "who are you", "kaun ho", "naam kya hai", "name kya hai", "what is your name"]):
            chunks = [
                "Mera naam **StudyMate AI** hai! Main aapka 24/7 personal AI study tutor aur academic mentor hoon.\n\n",
                "Main aapki padhai se judi har zaroorat me madad karta hoon:\n",
                "- 💡 **Concept Clarification**: Complex topics ko real-world analogies aur simple Hinglish/English me explain karna.\n",
                "- 📝 **Cornell Notes**: Lecture PDFs aur syllabus se high-yield notes generate karna.\n",
                "- 🔀 **Active Recall & Quizzes**: Spaced repetition flashcards aur practice MCQs se revision karwana.\n",
                "- ⏱️ **Exam Strategies & Doubts**: Step-by-step mathematical derivations aur programming problems solve karna.\n\n",
                "Aap mujhse kisi bhi subject ya topic ke baare me poochh sakte hain. Aaj hum kya padhenge?",
            ]

        # 2. Greetings
        elif q_lower in ["hello", "hi", "hey", "namaste", "pranam", "kya haal hai", "good morning", "good evening", "good afternoon"]:
            chunks = [
                "Namaste! Main **StudyMate AI** study tutor hoon.\n\n",
                "Aaj aapki padhai me main kya madad kar sakta hoon? ",
                "Aap koi specific subject ka question poochh sakte hain, kisi formula ka derivation samajh sakte hain, ya practice quiz generate karwa sakte hain.\n\n",
                "*Pro-Tip*: Agar aap kisi problem ko step-by-step hints ke sath samajhna chahte hain, to upar **Socratic Mode** toggle on kar sakte hain!",
            ]

        # 3. Socratic Tutoring Mode (Prioritized when active to foster step-by-step discovery)
        elif is_socratic:
            chunks = [
                f"That's an insightful question about **{user_query}**{context_str}!\n\n",
                "In Socratic mode, let's break it down together step-by-step so you discover the solution yourself:\n\n",
                "1. **Starting Principle**: What is the core formula, definition, or starting principle that applies here first?\n",
                "2. **Variable Analysis**: What are the known variables given in your problem, and what is the unknown target?\n\n",
                "*💡 Guiding Hint*: Think about the fundamental relationship between the components rather than jumping straight to the final answer.\n\n",
                "What formula or first algebraic step would you write down first?",
            ]

        # 4. Loops & Iteration (Python & General Programming)
        elif re.search(r'\b(loop|loops|for\s*loop|while\s*loop|nested\s*loop|iteration|iterate)\b', q_lower):
            chunks = [
                f"### 🔁 Python Loops — Complete Guide & Syntax{context_str}\n\n",
                "Python mein **Loops** ka istemal tab kiya jata hai jab aapko koi **code block ya instruction baar-baar (repeat)** execute karni ho.\n\n",
                "Python mein 2 mukhya loops hote hain:\n\n",
                "#### 1. `for` Loop (Definite Iteration):\n",
                "Jab aapko pehle se pata ho ki loop kitni baar chalana hai, ya kisi List, String, ya `range()` sequence par iterate karna ho:\n",
                "```python\n",
                "# Example 1: 1 se 5 tak numbers print karna\n",
                "for i in range(1, 6):\n",
                "    print(f'Number: {i}')\n\n",
                "# Example 2: List items par iterate karna\n",
                "fruits = ['Apple', 'Banana', 'Mango']\n",
                "for fruit in fruits:\n",
                "    print(fruit)\n",
                "```\n\n",
                "#### 2. `while` Loop (Condition-driven Iteration):\n",
                "Ye loop tab tak chalta rehta hai jab tak di gayi **condition `True`** rehti hai:\n",
                "```python\n",
                "count = 1\n",
                "while count <= 5:\n",
                "    print('Count:', count)\n",
                "    count += 1  # Increment jaruri hai, warna infinite loop ban jayega\n",
                "```\n\n",
                "#### ⚡ Loop Control Keywords:\n",
                "- **`break`**: Condition match hote hi loop ko beech mein hi terminate/rok deta hai.\n",
                "- **`continue`**: Current round ko skip karke seedha agle iteration par jump karta hai.\n",
                "- **`pass`**: Placeholder keyword jab loop body ko empty rakhna ho.\n\n",
                "**Exam Summary**: `for` loop fixed sequences ke liye best hai; `while` loop condition-based execution ke liye use hota hai.",
            ]

        # 5. Object-Oriented Programming (OOP)
        elif re.search(r'\b(oop|oops|object\s*oriented|polymorphism|encapsulation|inheritance|abstraction)\b', q_lower):
            chunks = [
                f"### 💻 Object-Oriented Programming (OOP) — Core Pillars{context_str}\n\n",
                "OOP is a programming paradigm based on the concept of **Objects** (data + methods). It models real-world entities into modular, reusable code.\n\n",
                "#### The 4 Golden Pillars of OOP:\n",
                "1. **Encapsulation (Data Hiding)**:\n",
                "   - Wrapping data (variables) and methods inside a single unit (Class) and restricting direct access.\n",
                "   - *Analogy*: A medical capsule hiding chemical medicine inside a gelatin shell.\n",
                "   - *Code Example* (Python):\n",
                "   ```python\n",
                "   class BankAccount:\n",
                "       def __init__(self, balance):\n",
                "           self.__balance = balance  # Private attribute\n",
                "       def get_balance(self):\n",
                "           return self.__balance\n",
                "   ```\n\n",
                "2. **Abstraction (Hiding Complexity)**:\n",
                "   - Exposing only the essential interface to the user while hiding internal implementation details.\n",
                "   - *Analogy*: Pressing the car accelerator pedal without needing to know how the fuel injector works.\n\n",
                "3. **Inheritance (Code Reusability)**:\n",
                "   - Child class acquires the properties and methods of a Parent class (`class ElectricCar(Car)`).\n\n",
                "4. **Polymorphism (Many Forms)**:\n",
                "   - Ability of a message/method to be processed in more than one way (Method Overloading & Method Overriding).\n",
                "   - *Example*: `shape.draw()` behaves differently for `Circle` vs `Square`.\n\n",
                "**Exam Takeaway**: Encapsulation hides **data**; Abstraction hides **implementation complexity**.",
            ]

        # 4. Networking TCP vs UDP
        elif "tcp" in q_lower and "udp" in q_lower:
            chunks = [
                f"### 🌐 TCP vs UDP — Key Differences for Exams{context_str}\n\n",
                "| Feature | TCP (Transmission Control Protocol) | UDP (User Datagram Protocol) |\n",
                "| :--- | :--- | :--- |\n",
                "| **Connection** | Connection-Oriented (3-way handshake) | Connectionless (sends immediately) |\n",
                "| **Reliability** | Guaranteed delivery (ACK + Retransmission) | Best-effort (packets may drop) |\n",
                "| **Ordering** | In-order delivery guaranteed by sequence # | No order guarantee |\n",
                "| **Speed** | Slower (overhead due to checks & flow control) | Blazing fast & minimum latency |\n",
                "| **Header Size** | 20-60 bytes | 8 bytes |\n",
                "| **Use Cases** | Web (HTTP/HTTPS), Email (SMTP), File Transfer | Live streaming, Online Gaming, VoIP |\n\n",
                "#### 🤝 TCP 3-Way Handshake (Exam Favorite):\n",
                "1. **SYN**: Client sends `SYN (seq=x)` $\\rightarrow$ Server\n",
                "2. **SYN-ACK**: Server replies `SYN (seq=y) + ACK (x+1)` $\\rightarrow$ Client\n",
                "3. **ACK**: Client sends `ACK (y+1)` $\\rightarrow$ Connection Established!\n\n",
                "**Exam Mnemonic**: *TCP = Accurate & Orderly*, *UDP = Rapid & Real-time*.",
            ]

        # 5. DBMS: ACID Properties & Normalization
        elif any(w in q_lower for w in ["acid", "normalization", "dbms", "database", "1nf", "2nf", "3nf", "bcnf", "sql join"]):
            chunks = [
                f"### 🗄️ Database Management — ACID & Normalization{context_str}\n\n",
                "#### 1. ACID Properties (Transaction Reliability):\n",
                "- **Atomicity (All or Nothing)**: A transaction must either completely succeed or completely rollback. No partial states.\n",
                "- **Consistency (Preserving Rules)**: Database transitions from one valid state to another, maintaining constraints and triggers.\n",
                "- **Isolation (Concurrent Safety)**: Concurrent transactions execute as if they are running serially without intermediate dirty reads.\n",
                "- **Durability (Permanence)**: Once committed, data is permanently saved on non-volatile storage, even during power failures.\n\n",
                "#### 2. Normalization Stages (Reducing Redundancy):\n",
                "1. **1NF**: Atomic values only (no repeating groups or comma-separated lists in a single cell).\n",
                "2. **2NF**: Must be in 1NF **+** No Partial Dependency (every non-key attribute must fully depend on the entire primary key).\n",
                "3. **3NF**: Must be in 2NF **+** No Transitive Dependency ($A \\rightarrow B$ and $B \\rightarrow C$, where $C$ is non-prime).\n",
                "4. **BCNF**: Stricter 3NF where for every functional dependency $X \\rightarrow Y$, $X$ must be a super key.\n\n",
                "**Exam Formula**: $\\text{Redundancy Reduction} \\implies \\text{Elimination of Insertion, Deletion, and Update Anomalies}$.",
            ]

        # 6. Data Structures: Search & Sorting Algorithms
        elif any(w in q_lower for w in ["binary search", "sorting", "quicksort", "mergesort", "dijkstra", "dsa", "stack", "queue"]):
            chunks = [
                f"### 📊 Algorithms & Complexity — Deep Dive{context_str}\n\n",
                "#### Binary Search vs Linear Search:\n",
                "- **Linear Search**: Scans element-by-element. Time: $\\mathcal{O}(n)$, Works on unsorted arrays.\n",
                "- **Binary Search**: Divide-and-conquer on **sorted arrays**. Divides search space in half each step.\n\n",
                "$$\\text{Recurrence Relation: } T(n) = T(n/2) + \\mathcal{O}(1) \\implies \\text{Time Complexity: } \\mathcal{O}(\\log n)$$\n\n",
                "#### Asymptotic Bounds Comparison for Exams:\n",
                "| Algorithm | Best Case | Average Case | Worst Case | Space Complexity |\n",
                "| :--- | :--- | :--- | :--- | :--- |\n",
                "| **Binary Search** | $\\mathcal{O}(1)$ | $\\mathcal{O}(\\log n)$ | $\\mathcal{O}(\\log n)$ | $\\mathcal{O}(1)$ iterative |\n",
                "| **QuickSort** | $\\mathcal{O}(n \\log n)$ | $\\mathcal{O}(n \\log n)$ | $\\mathcal{O}(n^2)$ (sorted pivot) | $\\mathcal{O}(\\log n)$ stack |\n",
                "| **MergeSort** | $\\mathcal{O}(n \\log n)$ | $\\mathcal{O}(n \\log n)$ | $\\mathcal{O}(n \\log n)$ (stable) | $\\mathcal{O}(n)$ auxiliary |\n\n",
                "**Exam Tip**: QuickSort is faster in practice due to cache locality, but MergeSort is preferred when guaranteed worst-case $\\mathcal{O}(n \\log n)$ and stability are required.",
            ]

        # 7. Operating Systems: Process vs Thread & Scheduling
        elif any(w in q_lower for w in ["operating system", "process", "thread", "deadlock", "scheduling", "paging", "virtual memory"]):
            chunks = [
                f"### ⚙️ Operating Systems — Core Principles{context_str}\n\n",
                "#### Process vs Thread:\n",
                "- **Process**: An executing program with its own dedicated memory address space (Text, Data, Heap, Stack). Heavyweight context switching.\n",
                "- **Thread**: A lightweight unit of execution *within* a process. Threads share the same code and heap memory but have private stacks and program counters.\n\n",
                "#### 🔒 The 4 Coffman Conditions for Deadlock (Exam Essential):\n",
                "1. **Mutual Exclusion**: At least one resource must be held in a non-shareable mode.\n",
                "2. **Hold and Wait**: A process holds $\\ge 1$ resource while waiting to acquire additional resources.\n",
                "3. **No Preemption**: Resources cannot be forcibly taken from a process holding them.\n",
                "4. **Circular Wait**: A closed chain of processes exists such that each process holds resources needed by the next.\n\n",
                "**Prevention Strategy**: Invalidate any ONE of these 4 conditions to make deadlock impossible.",
            ]

        # 8. Mathematics: Calculus, Algebra, Probability
        elif any(w in q_lower for w in ["derivative", "calculus", "integral", "chain rule", "quadratic", "bayes", "eigen", "matrix"]):
            chunks = [
                f"### 📐 Mathematical Formulation & Derivations{context_str}\n\n",
                "#### 1. Core Calculus Rules:\n",
                "- **Power Rule**: $\\frac{d}{dx}[x^n] = n x^{n-1}$\n",
                "- **Product Rule**: $\\frac{d}{dx}[u \\cdot v] = u'v + uv'$\n",
                "- **Chain Rule (Composite Functions)**:\n",
                "$$\\frac{dy}{dx} = \\frac{dy}{du} \\cdot \\frac{du}{dx}$$\n\n",
                "#### 2. Quadratic Formula & Discriminant Analysis:\n",
                "For any polynomial $ax^2 + bx + c = 0$, the roots are given by:\n",
                "$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\n",
                "- If $\\Delta = b^2 - 4ac > 0$: Two distinct real roots.\n",
                "- If $\\Delta = 0$: One repeated real root ($x = -b / 2a$).\n",
                "- If $\\Delta < 0$: Two complex conjugate roots ($x = \\alpha \\pm i\\beta$).\n\n",
                "#### 3. Bayes' Theorem (Conditional Probability):\n",
                "$$P(A \\mid B) = \\frac{P(B \\mid A) \\cdot P(A)}{P(B)}$$\n",
                "Where $P(A \\mid B)$ is the posterior, $P(B \\mid A)$ is the likelihood, and $P(A)$ is the prior probability.",
            ]

        # 9. Physics & Engineering: Newton's Laws & Circuits
        elif any(w in q_lower for w in ["newton", "ohm", "kirchhoff", "physics", "thermodynamics", "kinetic energy", "velocity"]):
            chunks = [
                f"### ⚡ Physics & Engineering Principles{context_str}\n\n",
                "#### 1. Newton's Three Laws of Motion:\n",
                "1. **Law of Inertia**: A body remains at rest or in uniform velocity unless acted upon by a net external force ($\\sum \\vec{F} = 0 \\implies \\vec{a} = 0$).\n",
                "2. **Fundamental Equation of Dynamics**:\n",
                "$$\\vec{F}_{\\text{net}} = m \\cdot \\vec{a} = \\frac{d\\vec{p}}{dt}$$\n",
                "3. **Action-Reaction**: For every action force $\\vec{F}_{AB}$, there is an equal and opposite reaction force: $\\vec{F}_{AB} = -\\vec{F}_{BA}$.\n\n",
                "#### 2. Circuit Laws (Ohm's & Kirchhoff's):\n",
                "- **Ohm's Law**: $V = I \\cdot R$ (Voltage equals Current $\\times$ Resistance).\n",
                "- **Kirchhoff's Current Law (KCL)**: $\\sum I_{\\text{in}} = \\sum I_{\\text{out}}$ (Conservation of Charge at any node).\n",
                "- **Kirchhoff's Voltage Law (KVL)**: $\\sum_{\\text{loop}} V = 0$ (Conservation of Energy around any closed circuit loop).",
            ]

        # 11. Biology: Photosynthesis & Cell Respiration
        elif any(w in q_lower for w in ["photosynthesis", "cellular respiration", "mitochondria", "biology", "dna", "rna", "cell", "organism"]):
            chunks = [
                f"### 🌿 Biological Systems — Photosynthesis & Cell Functions{context_str}\n\n",
                "Biology mein life processes energy conversion aur cellular structures par depend karte hain.\n\n",
                "#### 1. Photosynthesis Equation (Light $\\rightarrow$ Chemical Energy):\n",
                "$$6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{photons} \\xrightarrow{\\text{chlorophyll}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$$\n\n",
                "#### 2. Two Primary Stages:\n",
                "- **Light-Dependent Reactions (Thylakoids)**: Sunlight water molecules ko split (photolysis) karke $\\text{O}_2$, ATP aur NADPH produce karti hai.\n",
                "- **Calvin Cycle / Dark Reaction (Stroma)**: RuBisCO enzyme ki madad se $\\text{CO}_2$ ko fix karke Glucose banta hai.\n\n",
                "#### 3. Cellular Respiration (Mitochondria):\n",
                "Glucose break hokar cell ko ATP (Energy Currency) provide karta hai: $$\\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\rightarrow 6\\text{CO}_2 + 6\\text{H}_2\\text{O} + 36\\text{--}38\\text{ ATP}$$\n\n",
                "**Exam Point**: Plants photosynthesis se food banate hain; sabhi living organisms cellular respiration se ATP energy generate karte hain.",
            ]

        # 12. Chemistry: Periodic Table, Bonding & Chemical Reactions
        elif any(w in q_lower for w in ["chemistry", "periodic table", "chemical bond", "covalent", "ionic bond", "acid", "base", "ph scale", "mole concept", "atom"]):
            chunks = [
                f"### ⚛️ Chemistry Foundations — Structure, Bonding & Reactions{context_str}\n\n",
                "Chemistry atoms, unke electronic configuration aur chemical reactions ki study hai.\n\n",
                "#### 1. Periodic Table & Classification:\n",
                "- **Groups (Vertical)**: Elements with the same valence electrons share similar chemical properties (e.g. Alkali metals Group 1, Halogens Group 17).\n",
                "- **Periods (Horizontal)**: Elements with the same number of electron shells.\n\n",
                "#### 2. Chemical Bonding (Octet Rule):\n",
                "- **Ionic Bond**: Complete transfer of electrons from a metal to a non-metal (e.g. $\\text{Na}^+ + \\text{Cl}^- \\rightarrow \\text{NaCl}$).\n",
                "- **Covalent Bond**: Sharing of electron pairs between non-metals (e.g. $\\text{H}_2\\text{O}$, $\\text{CH}_4$).\n\n",
                "#### 3. Acids, Bases & pH Scale:\n",
                "- **pH Scale**: $$\\text{pH} = -\\log_{10}[\\text{H}^+]$$\n",
                "- $\\text{pH} < 7$: Acidic (excess $\\text{H}^+$ ions)\n",
                "- $\\text{pH} = 7$: Neutral (Pure Water)\n",
                "- $\\text{pH} > 7$: Basic / Alkaline (excess $\\text{OH}^-$ ions)\n\n",
                "**Exam Takeaway**: Ionic compounds form crystalline lattices with high melting points; Covalent molecules have directional bonds and lower boiling points.",
            ]

        # 13. Commerce & Economics: Demand, Supply, Inflation & Balance Sheet
        elif any(w in q_lower for w in ["economics", "demand", "supply", "inflation", "gdp", "commerce", "accounting", "balance sheet", "debit", "credit", "market"]):
            chunks = [
                f"### 📈 Economics & Commerce — Core Principles & Analysis{context_str}\n\n",
                "Economics allocation of scarce resources aur market mechanics ko understand karta hai.\n\n",
                "#### 1. Law of Demand & Supply:\n",
                "- **Law of Demand**: Keeping other factors constant (*ceteris paribus*), jab kisi commodity ka price badhta hai ($P \\uparrow$), to quantity demanded kam hoti hai ($Q_d \\downarrow$).\n",
                "- **Law of Supply**: Jab price badhta hai ($P \\uparrow$), producers zyada supply karte hain ($Q_s \\uparrow$).\n",
                "- **Market Equilibrium**: Jahan Demand curve aur Supply curve intersect karte hain ($Q_d = Q_s$).\n\n",
                "#### 2. Macroeconomics Key Metrics:\n",
                "- **GDP (Gross Domestic Product)**: Total monetary value of all finished goods & services produced within a country in a given year ($$Y = C + I + G + (X - M)$$).\n",
                "- **Inflation**: Persistent increase in the general price level, reducing the purchasing power of money.\n\n",
                "#### 3. Fundamental Accounting Rule:\n",
                "$$\\text{Assets} = \\text{Liabilities} + \\text{Owner's Equity}$$\n",
                "- *Golden Rule*: Debit what comes in / receiver; Credit what goes out / giver.\n\n",
                "**Exam Insight**: Elasticity of demand ($E_d = \\frac{\\% \\Delta Q}{\\% \\Delta P}$) measures consumer responsiveness to price changes.",
            ]

        # 14. History & Civics: Constitution, Democracy & Historical Movements
        elif any(w in q_lower for w in ["history", "civics", "constitution", "preamble", "democracy", "fundamental rights", "parliament", "revolution", "freedom"]):
            chunks = [
                f"### 📜 Civics & History — Governance & Societal Evolution{context_str}\n\n",
                "Society aur governance ke fundamental principles rules of law aur historical milestones se form hote hain.\n\n",
                "#### 1. The Constitution & Preamble:\n",
                "Constitution kisi bhi nation ka supreme legal document hota hai jo government ki powers define karta hai aur citizens ke rights protect karta hai.\n",
                "- **Core Pillars**: Sovereign, Socialist, Secular, Democratic, Republic.\n",
                "- **Guaranteed Values**: Justice (Social, Economic, Political), Liberty, Equality, and Fraternity.\n\n",
                "#### 2. Fundamental Rights:\n",
                "- **Right to Equality**: Equal treatment before law regardless of religion, caste, sex, or birth.\n",
                "- **Right to Freedom**: Freedom of speech, peaceful assembly, movement, and profession.\n",
                "- **Right to Constitutional Remedies**: Citizens can approach the judiciary if their rights are violated.\n\n",
                "#### 3. Historical Analysis Methodology:\n",
                "Exam me kisi bhi historical event (e.g. Industrial Revolution, Freedom Movement) ko 3 angles se evaluate karein:\n",
                "1. **Underlying Causes**: Economic distress, political oppression, or social reform.\n",
                "2. **Turning Points**: Key treaties, protests, or leadership declarations.\n",
                "3. **Long-Term Impact**: Constitutional changes, socio-economic transitions, and modern lessons.\n\n",
                "**Exam Takeaway**: Democracy works through institutional checks and balances between Legislature, Executive, and Judiciary.",
            ]

        # 15. Universal Academic Educational Query (Multi-Disciplinary Masterclass)
        else:
            chunks = [
                f"### 📖 Academic Breakdown: {user_query}{context_str}\n\n",
                f"Aapka topic: **{user_query}**\n\n",
                "#### 1. 💡 Core Definition & Intuition\n",
                f"**{user_query}** ka mukhya uddeshya kisi system ya process ke rules aur relationships ko clearly define karna hota hai. "
                "Exams aur academic coursework me is concept ko isliye test kiya jata hai taaki aap iske fundamental principles ko samajh kar real scenarios me apply kar sakein.\n\n",
                "#### 2. 🔍 Key Components & Mechanisms\n",
                "- **Foundational Principle**: Is topic ka starting rule ya law jo har condition me apply hota hai.\n",
                "- **Interacting Factors**: Wo variables ya elements jo ek dusre par depend karte hain aur outcome ko influence karte hain.\n",
                "- **Practical Constraints**: Wo conditions jahan ye principle modify hota hai ya boundary conditions trigger hoti hain.\n\n",
                "#### 3. 🎯 Real-World Analogy\n",
                f"Socho jaise ek well-organized system me har component ka apna specific role hota hai, theek usi tarah **{user_query}** structured rules ke through predictable results create karta hai.\n\n",
                "#### 4. 📝 High-Yield Exam Takeaway\n",
                "- Exam me answer likhte samay pehle **Standard Definition** se start karein.\n",
                "- Important formulas, dates, ya core keywords ko hamesha underline ya highlight karein.\n",
                "- End me ek crisp real-life example ya application zaroor mention karein.\n\n",
                "**Study Recommendation**: Is explanation ko apne Study Notes me save karne ke liye neeche **'📝 Save Note'** tap karein, ya step-by-step hints ke liye **Socratic Mode** toggle on karein!",
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
        title_prefix = depth_titles.get(depth, depth.capitalize())
        return {
            "topic": topic,
            "depth": depth,
            "explanation": (
                f"### {topic} — {title_prefix}\n\n"
                f"Imagine **{topic}** as an organized system where inputs systematically transform into outputs. "
                "In academic study, mastering this concept requires understanding the underlying mechanism rather than rote memorization.\n\n"
                "#### Conceptual Breakdown:\n"
                "1. **Foundational Rule**: Governs state transitions and core behavior.\n"
                "2. **Boundary Conditions**: Where the principle holds and where edge-cases occur.\n"
                "3. **Practical Application**: Real-world implementation in modern engineering and scientific practice."
            ),
            "key_takeaways": [
                f"Core mechanism of {topic} is deterministic and structured.",
                "Always check edge constraints before applying generalized rules.",
                "Review this using spaced repetition within 24 hours for long-term retention.",
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
                "## Cues & Key Questions\n"
                "- What are the fundamental assumptions and constraints?\n"
                "- How do these components link together in practical applications?\n\n"
                "## Notes\n"
                f"{source_text[:600]}...\n\n"
                "## Summary\n"
                "These structured notes encapsulate key principles and mechanisms for active review and exam preparation."
            ),
            "key_points": [
                "Fundamental definitions and equations established.",
                "Core relationship between variables synthesized.",
                "Review interval: 3 days via spaced repetition.",
            ],
            "summary": "Concise synthesis of lecture concepts ready for spaced repetition review.",
        }

    def _mock_document_summary(
        self,
        extracted_text: str,
        doc_title: str,
    ) -> dict[str, Any]:
        snippet = extracted_text[:250] if extracted_text else "Course reading material."
        return {
            "summary_tldr": (
                f"This document '{doc_title}' covers core principles and structural methodologies. "
                f"Key discussion revolves around: {snippet.strip()}... "
                "It serves as essential reference material for upcoming exams and active recall."
            ),
            "summary_key_concepts": [
                {
                    "concept": "Foundational Overview",
                    "explanation": "Introduces primary terminology, assumptions, and analytical framework.",
                },
                {
                    "concept": "Methodological Steps",
                    "explanation": "Details the phased approach to solving relevant problem sets.",
                },
                {
                    "concept": "Critical Takeaway",
                    "explanation": "Emphasizes practical constraints, exam-tested formulas, and real-world trade-offs.",
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

        # Question 1: Foundational concept
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

        # Question 2: Efficiency / Complexity
        questions.append({
            "question_text": "What is the primary constraint to evaluate when analyzing time and memory trade-offs?",
            "question_type": "mcq",
            "options": [
                {"key": "A", "text": "Only physical screen resolution"},
                {"key": "B", "text": "Asymptotic bounds (Big-O) relative to input size N"},
                {"key": "C", "text": "Color theme formatting parameters"},
                {"key": "D", "text": "Font size variations in notes"},
            ],
            "correct_option_key": "B",
            "explanation": "Option B is correct because asymptotic notation measures algorithmic complexity independently of hardware specifics.",
        })

        # Question 3: TCP vs UDP (if networking mentioned)
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

        # Question 4: Memory / Storage
        questions.append({
            "question_text": "In spaced repetition systems (e.g. SuperMemo SM-2), what determines the next review interval?",
            "question_type": "mcq",
            "options": [
                {"key": "A", "text": "Recall quality score (0-5) and previous ease factor"},
                {"key": "B", "text": "The student's battery percentage"},
                {"key": "C", "text": "The length of the card's file name"},
                {"key": "D", "text": "Purely randomized time selection"},
            ],
            "correct_option_key": "A",
            "explanation": "Option A is correct: SM-2 dynamically adjusts intervals using student recall ratings and ease factor multiplier.",
        })

        # Question 5: Modularity / Abstraction
        questions.append({
            "question_text": "In Object-Oriented software design, what is the primary benefit of Encapsulation?",
            "question_type": "mcq",
            "options": [
                {"key": "A", "text": "Allowing global uncontrolled write access to all variables"},
                {"key": "B", "text": "Hiding internal state and enforcing controlled access through methods"},
                {"key": "C", "text": "Compiling code directly to assembly without linking"},
                {"key": "D", "text": "Eliminating the need for comments in functions"},
            ],
            "correct_option_key": "B",
            "explanation": "Option B is correct: Encapsulation protects sensitive internal fields by bundling data with methods.",
        })

        return questions[:question_count]

    def _mock_task_breakdown(
        self,
        title: str,
        description: str | None,
        estimated_minutes: int | None,
    ) -> list[dict[str, Any]]:
        title_lower = title.lower()
        if any(w in title_lower for w in ["essay", "paper", "report", "write"]):
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
            {
                "id": str(t.get("id")),
                "title": str(t.get("title")),
                "priority": str(t.get("priority")),
                "due": str(t.get("due_datetime", "Today")),
            }
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
