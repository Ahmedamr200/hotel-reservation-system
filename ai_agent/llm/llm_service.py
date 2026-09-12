import os
import time
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ServerError

load_dotenv()


class LLMService:
    """
    Central service for interacting with the Gemini LLM via official google-genai SDK.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_output_tokens: int = 1024,
    ):
        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add GEMINI_API_KEY to your .env file."
            )

        self.client = genai.Client(api_key=api_key)

        # FIX: gemini-2.5-flash was shut down by Google. Default now points to
        # a currently-supported model, and can still be overridden via .env
        # (GEMINI_MODEL=...) without touching this file again in the future.
        self.model = (
            model
            or os.getenv("GEMINI_MODEL")
            or "gemini-3.6-flash"
        )

        self.temperature = temperature
        self.max_output_tokens = max_output_tokens

    def _generation_config(
        self,
        tools: Optional[List[Any]] = None,
        system_instruction: Optional[str] = None,
    ) -> types.GenerateContentConfig:
        """
        Build Gemini generation configuration.
        """
        config_kwargs = {
            "temperature": self.temperature,
            "max_output_tokens": self.max_output_tokens,
        }

        if tools:
            config_kwargs["tools"] = tools

        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction

        return types.GenerateContentConfig(**config_kwargs)

    def _parse_messages(
        self,
        messages: List[Dict[str, Any]],
    ) -> tuple[Optional[str], str]:
        """
        فصل تعليمات النظام (System Prompt) عن باقي محادثة المستخدم.
        """
        system_instruction = None
        prompt_parts = []

        for message in messages:
            role = message.get("role", "user")
            content = message.get("content", "")
            tool_calls = message.get("tool_calls")

            if not content and not tool_calls:
                continue

            if role == "system":
                system_instruction = content
            elif role == "user":
                prompt_parts.append(f"USER:\n{content}")
            elif role == "assistant":
                call_info = ""
                if tool_calls:
                    import json
                    call_info = f"\nTOOL CALLS: {json.dumps(tool_calls, ensure_ascii=False)}"
                prompt_parts.append(f"ASSISTANT:\n{content or ''}{call_info}".strip())
            elif role == "tool":
                tool_name = message.get("name") or message.get("tool_name", "tool")
                prompt_parts.append(f"TOOL RESULT ({tool_name}):\n{content}")

        return system_instruction, "\n\n".join(prompt_parts)

    def chat(
        self,
        messages: List[Dict[str, Any]],
    ) -> str:
        if not messages:
            raise ValueError("messages cannot be empty.")

        system_instruction, prompt = self._parse_messages(messages)

        config = self._generation_config(system_instruction=system_instruction)

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=config,
        )

        text = getattr(response, "text", None)
        return text.strip() if text else ""

    def _convert_schema(
        self,
        schema: Dict[str, Any],
    ) -> types.Schema:
        """
        Convert JSON schema to Gemini Schema using types.Type enum.
        """
        schema_type = schema.get("type", "string")

        if isinstance(schema_type, list):
            if "string" in schema_type:
                schema_type = "string"
            elif "integer" in schema_type:
                schema_type = "integer"
            elif "number" in schema_type:
                schema_type = "number"
            elif "boolean" in schema_type:
                schema_type = "boolean"
            elif "object" in schema_type:
                schema_type = "object"
            else:
                schema_type = "string"

        # استخدام Enums الخاصة بـ SDK لضمان عدم وجود أخطاء في الـ Schema Validation
        type_mapping = {
            "string": types.Type.STRING,
            "integer": types.Type.INTEGER,
            "number": types.Type.NUMBER,
            "boolean": types.Type.BOOLEAN,
            "object": types.Type.OBJECT,
            "array": types.Type.ARRAY,
        }

        gemini_type = type_mapping.get(schema_type, types.Type.STRING)
        schema_kwargs = {"type": gemini_type}

        description = schema.get("description")
        if description:
            schema_kwargs["description"] = description

        if schema_type == "object":
            properties = schema.get("properties", {})
            gemini_properties = {}
            for name, property_schema in properties.items():
                gemini_properties[name] = self._convert_schema(property_schema)

            schema_kwargs["properties"] = gemini_properties

            required = schema.get("required", [])
            if required:
                schema_kwargs["required"] = required

        if schema_type == "array":
            items = schema.get("items", {"type": "string"})
            schema_kwargs["items"] = self._convert_schema(items)

        return types.Schema(**schema_kwargs)

    def _convert_tools(
        self,
        tools: List[Dict[str, Any]],
    ) -> List[types.Tool]:
        gemini_tools = []

        for tool in tools:
            function = tool.get("function", tool)
            name = function.get("name")

            if not name:
                continue

            description = function.get("description", "")
            parameters = function.get(
                "parameters",
                {"type": "object", "properties": {}},
            )

            parameter_schema = self._convert_schema(parameters)

            function_declaration = types.FunctionDeclaration(
                name=name,
                description=description,
                parameters=parameter_schema,
            )

            gemini_tools.append(
                types.Tool(function_declarations=[function_declaration])
            )

        return gemini_tools

    def decide(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
    ):
        if not messages:
            raise ValueError("messages cannot be empty.")

        system_instruction, prompt = self._parse_messages(messages)
        gemini_tools = self._convert_tools(tools)

        config = self._generation_config(
            tools=gemini_tools,
            system_instruction=system_instruction,
        )

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=config,
        )

        return response

    def get_tool_calls(
        self,
        response,
    ) -> List[Dict[str, Any]]:
        tool_calls = []
        candidates = getattr(response, "candidates", None)

        if not candidates:
            return tool_calls

        for candidate in candidates:
            content = getattr(candidate, "content", None)
            if not content:
                continue

            parts = getattr(content, "parts", None)
            if not parts:
                continue

            for part in parts:
                function_call = getattr(part, "function_call", None)
                if not function_call:
                    continue

                arguments = getattr(function_call, "args", {})
                tool_calls.append(
                    {
                        "name": function_call.name,
                        "arguments": dict(arguments),
                    }
                )

        return tool_calls

    def get_response_text(
        self,
        response,
    ) -> str:
        text = getattr(response, "text", None)
        return text.strip() if text else ""

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        ADDED: Adapter method used by MainAgent (agents/main_agent.py).

        MainAgent's tool-calling loop expects an OpenAI-style response shape:
            response.get("content")
            response.get("tool_calls")       -> list of {"id", "function": {"name", "arguments"}}
            response.get("raw_message")      -> appended back into the conversation payload

        This wraps the native Gemini SDK call (same path as `decide()` /
        `get_tool_calls()` / `get_response_text()`) and reshapes the result
        into that dict, so MainAgent does not need to know anything about
        the Gemini SDK's response objects.
        """
        if not messages:
            raise ValueError("messages cannot be empty.")

        system_instruction, prompt = self._parse_messages(messages)

        if tools:
            gemini_tools = self._convert_tools(tools)
            config = self._generation_config(
                tools=gemini_tools, system_instruction=system_instruction
            )
        else:
            config = self._generation_config(system_instruction=system_instruction)

        # Retry with backoff on transient "model overloaded" errors (HTTP 503).
        # These come from Google's servers being temporarily busy, not from
        # our code, and usually succeed within a couple of seconds.
        max_retries = 3
        response = None
        last_error = None
        for attempt in range(max_retries):
            try:
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=config,
                )
                break
            except ServerError as exc:
                last_error = exc
                if "UNAVAILABLE" in str(exc) or "503" in str(exc):
                    wait_seconds = 2 * (attempt + 1)
                    print(f"[LLM RETRY] Model overloaded, retrying in {wait_seconds}s "
                          f"(attempt {attempt + 1}/{max_retries})...")
                    time.sleep(wait_seconds)
                    continue
                raise

        if response is None:
            # All retries exhausted — return a graceful fallback instead of
            # crashing the tool-calling loop in MainAgent.
            print(f"[LLM RETRY] Giving up after {max_retries} attempts: {last_error}")
            return {
                "content": "Sorry, the AI service is temporarily overloaded. Please try again in a moment.",
                "tool_calls": None,
                "raw_message": {"role": "assistant", "content": "Service temporarily unavailable."},
            }

        text = self.get_response_text(response)
        raw_tool_calls = self.get_tool_calls(response)

        tool_calls = None
        if raw_tool_calls:
            tool_calls = [
                {
                    "id": f"call_{i}",
                    "function": {
                        "name": tc["name"],
                        # get_tool_calls() already returns a plain dict here,
                        # so MainAgent's `isinstance(arguments, str)` check
                        # is False and it uses it as-is. No json.loads needed.
                        "arguments": tc["arguments"],
                    },
                }
                for i, tc in enumerate(raw_tool_calls)
            ]

        return {
            "content": text,
            "tool_calls": tool_calls,
            "raw_message": {"role": "assistant", "content": text},
        }

    def health_check(self) -> bool:
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents="Reply with: OK",
                config=self._generation_config(),
            )
            text = self.get_response_text(response)
            return bool(text)
        except Exception as exc:
            print(f"[LLM HEALTH CHECK ERROR] {exc}")
            return False