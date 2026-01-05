"""
Application configuration using Pydantic Settings.

Loads configuration from environment variables and .env file.
Provides type-safe access to all settings with validation.
"""

from functools import lru_cache
from typing import Literal, Optional, List

from pydantic_settings import BaseSettings, SettingsConfigDict


# Type alias for provider names
Provider = Literal["rule_based", "anthropic", "openai", "gemini", "local"]


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    All settings can be overridden via environment variables.
    Environment variables are case-insensitive.

    Example:
        ANTHROPIC_API_KEY=sk-ant-xxx
        DEFAULT_PROVIDER=anthropic
    """

    # ===========================================
    # LLM Provider API Keys
    # ===========================================

    anthropic_api_key: Optional[str] = None
    """Anthropic API key for Claude models. Required if using anthropic provider."""

    openai_api_key: Optional[str] = None
    """OpenAI API key for GPT models. Required if using openai provider."""

    gemini_api_key: Optional[str] = None
    """Google Gemini API key. Required if using gemini provider."""

    # ===========================================
    # LLM Configuration
    # ===========================================

    default_provider: Provider = "rule_based"
    """Default LLM provider to use when not specified in request."""

    anthropic_model: str = "claude-sonnet-4-20250514"
    """Anthropic model to use for planning."""

    openai_model: str = "gpt-4o"
    """OpenAI model to use for planning."""

    gemini_model: str = "gemini-1.5-pro"
    """Google Gemini model to use for planning."""

    local_model_url: str = "http://localhost:11434/api/generate"
    """URL for local LLM API (e.g., Ollama)."""

    local_model_name: str = "llama3"
    """Model name for local LLM."""

    # ===========================================
    # Server Configuration
    # ===========================================

    host: str = "127.0.0.1"
    """Host to bind the server to."""

    port: int = 8765
    """Port to run the server on."""

    debug: bool = False
    """Enable debug mode with additional logging."""

    reload: bool = False
    """Enable auto-reload on file changes (development only)."""

    # ===========================================
    # CORS Configuration
    # ===========================================

    cors_origins: List[str] = ["*"]
    """Allowed CORS origins. Use ["*"] for development, restrict in production."""

    cors_allow_credentials: bool = False
    """Whether to allow credentials in CORS requests."""

    cors_allow_methods: List[str] = ["*"]
    """Allowed HTTP methods for CORS."""

    cors_allow_headers: List[str] = ["*"]
    """Allowed headers for CORS."""

    # ===========================================
    # Pydantic Settings Configuration
    # ===========================================

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.

    Uses lru_cache to ensure settings are only loaded once.
    This is the recommended way to access settings throughout the application.

    Returns:
        Settings: The application settings instance.
    """
    return Settings()
