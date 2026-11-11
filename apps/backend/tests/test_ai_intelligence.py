import pytest

from app.services.ai_service import AIService


@pytest.mark.asyncio
async def test_ai_oop_tutoring() -> None:
    ai = AIService(api_key="mock-dev-key")
    messages = [{"role": "user", "content": "Explain OOP concepts and polymorphism with examples"}]

    chunks = []
    async for chunk in ai.stream_chat(messages=messages, is_socratic=False):
        chunks.append(chunk)

    full_text = "".join(chunks)
    assert "encapsulation" in full_text.lower()
    assert "polymorphism" in full_text.lower()
    assert "class" in full_text.lower()


@pytest.mark.asyncio
async def test_ai_networking_tcp_udp() -> None:
    ai = AIService(api_key="mock-dev-key")
    messages = [{"role": "user", "content": "What is the difference between TCP and UDP?"}]

    chunks = []
    async for chunk in ai.stream_chat(messages=messages, is_socratic=False):
        chunks.append(chunk)

    full_text = "".join(chunks)
    assert "handshake" in full_text.lower()
    assert "latency" in full_text.lower() or "connectionless" in full_text.lower()


@pytest.mark.asyncio
async def test_ai_dbms_normalization() -> None:
    ai = AIService(api_key="mock-dev-key")
    messages = [{"role": "user", "content": "Explain 1NF, 2NF and 3NF database normalization"}]

    chunks = []
    async for chunk in ai.stream_chat(messages=messages, is_socratic=False):
        chunks.append(chunk)

    full_text = "".join(chunks)
    assert "1nf" in full_text.lower()
    assert "dependency" in full_text.lower() or "redundancy" in full_text.lower()


@pytest.mark.asyncio
async def test_ai_model_resolution() -> None:
    ai = AIService(model_name="gemini-3.1-flash-lite")
    assert ai._resolve_gemini_model_name() == "gemini-3.1-flash-lite"

    ai_custom = AIService(model_name="gemini-2.0-flash")
    assert ai_custom._resolve_gemini_model_name() == "gemini-2.0-flash"


@pytest.mark.asyncio
async def test_ai_bilingual_greetings() -> None:
    ai = AIService(api_key="mock-dev-key")
    messages = [{"role": "user", "content": "Tumhara naam kya hai?"}]

    chunks = []
    async for chunk in ai.stream_chat(messages=messages, is_socratic=False):
        chunks.append(chunk)

    full_text = "".join(chunks)
    assert "studymate ai" in full_text.lower()
    assert "madad" in full_text.lower()

