"""
FastAPI application entry point.

Creates and configures the FastAPI app with middleware,
routers, and lifecycle management.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import plan


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.

    Runs setup code before the app starts accepting requests,
    and cleanup code after the app stops.
    """
    # Startup
    settings = get_settings()
    print(f"Starting Zen Tab Agent Server v0.2.0")
    print(f"Default provider: {settings.default_provider}")
    print(f"Debug mode: {settings.debug}")

    yield

    # Shutdown
    print("Shutting down...")


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application.

    Returns:
        Configured FastAPI app instance.
    """
    settings = get_settings()

    app = FastAPI(
        title="Zen Tab Agent Server",
        description="AI-powered browser automation planner",
        version="0.2.0",
        lifespan=lifespan,
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=settings.cors_allow_methods,
        allow_headers=settings.cors_allow_headers,
    )

    # Include routers
    app.include_router(plan.router)

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy", "version": "0.2.0"}

    # Detailed health check with provider status
    @app.get("/health/detailed")
    async def detailed_health_check():
        """
        Detailed health check with provider status.

        Returns status of each configured provider.
        """
        settings = get_settings()

        provider_status = {
            "rule_based": {"status": "available", "reason": "No API key required"},
            "anthropic": {
                "status": "available" if settings.anthropic_api_key else "unavailable",
                "reason": "API key configured" if settings.anthropic_api_key else "ANTHROPIC_API_KEY not set",
                "model": settings.anthropic_model if settings.anthropic_api_key else None,
            },
            "openai": {
                "status": "available" if settings.openai_api_key else "unavailable",
                "reason": "API key configured" if settings.openai_api_key else "OPENAI_API_KEY not set",
                "model": settings.openai_model if settings.openai_api_key else None,
            },
            "gemini": {
                "status": "available" if settings.gemini_api_key else "unavailable",
                "reason": "API key configured" if settings.gemini_api_key else "GEMINI_API_KEY not set",
                "model": settings.gemini_model if settings.gemini_api_key else None,
            },
            "local": {
                "status": "available",
                "reason": "Local LLM endpoint configured",
                "url": settings.local_model_url,
                "model": settings.local_model_name,
            },
        }

        available_count = sum(1 for p in provider_status.values() if p["status"] == "available")

        return {
            "status": "healthy",
            "version": "0.2.0",
            "default_provider": settings.default_provider,
            "providers": provider_status,
            "available_providers": available_count,
        }

    return app


# Create app instance
app = create_app()