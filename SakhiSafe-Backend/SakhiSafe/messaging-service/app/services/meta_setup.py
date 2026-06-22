import asyncio
import logging
import os
import subprocess
from typing import Optional
from urllib.parse import urlparse

import httpx
from app.config import get_settings

logger = logging.getLogger("meta-setup-service")

def _matches_target_port(tunnel_addr: str, target_port: int) -> bool:
    """
    ngrok tunnel config.addr can look like:
    - "http://localhost:8000"
    - "localhost:8000"
    - "http://0.0.0.0:8000"
    """
    if not tunnel_addr:
        return False

    addr = tunnel_addr.strip()
    if "://" not in addr:
        addr = f"http://{addr}"

    try:
        parsed = urlparse(addr)
        return parsed.port == target_port
    except Exception:
        return False


async def get_ngrok_url() -> Optional[str]:
    """
    Queries the local ngrok dashboard API (typically running on port 4040)
    to dynamically retrieve the active public HTTPS tunnel URL.
    """
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get("http://localhost:4040/api/tunnels")
            if resp.status_code == 200:
                data = resp.json()
                tunnels = data.get("tunnels", [])
                preferred_https_url: Optional[str] = None
                fallback_https_url: Optional[str] = None

                for tunnel in tunnels:
                    public_url = tunnel.get("public_url", "")
                    if not public_url.startswith("https://"):
                        continue

                    if fallback_https_url is None:
                        fallback_https_url = public_url

                    tunnel_addr = (tunnel.get("config") or {}).get("addr", "")
                    if _matches_target_port(tunnel_addr, settings.PORT):
                        preferred_https_url = public_url
                        break

                if preferred_https_url:
                    return preferred_https_url

                if fallback_https_url:
                    logger.warning(
                        "No ngrok HTTPS tunnel matched configured PORT=%s. Falling back to first HTTPS tunnel=%s",
                        settings.PORT,
                        fallback_https_url,
                    )
                    return fallback_https_url
    except Exception as e:
        logger.debug(f"Could not connect to local ngrok API on port 4040: {e}")
    return None

async def ensure_ngrok_running() -> Optional[str]:
    """
    Verifies if ngrok is active. If not, programmatically configures the
    NGROK_AUTHTOKEN and spins up the tunnel in a background subprocess.
    """
    settings = get_settings()

    # A. Check if ngrok is already running
    url = await get_ngrok_url()
    if url:
        logger.info(f"Existing active ngrok tunnel detected at: {url}")
        return url

    logger.info("No active ngrok tunnel found. Attempting programmatic launch...")

    # B. Apply auth token if configured
    if settings.NGROK_AUTHTOKEN:
        logger.info("Registering NGROK_AUTHTOKEN with local ngrok configuration...")
        try:
            cmd = ["ngrok", "config", "add-authtoken", settings.NGROK_AUTHTOKEN]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            logger.info("Successfully configured ngrok authtoken.")
        except Exception as e:
            logger.warning(f"Could not automatically configure ngrok authtoken: {e}")

    # C. Start the background ngrok subprocess
    try:
        logger.info(f"Launching programmatic background tunnel for port {settings.PORT}...")
        cmd = ["ngrok", "http", str(settings.PORT)]
        
        # Start in separate process group so it lives beyond the main thread setup triggers
        subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid if hasattr(os, "setsid") else None
        )

        # Poll the ngrok local dashboard API until the tunnel connects (up to 5 attempts)
        for attempt in range(5):
            await asyncio.sleep(1.5)
            url = await get_ngrok_url()
            if url:
                logger.info(f"Programmatic ngrok tunnel established successfully at: {url}")
                return url
                
        logger.error("ngrok process was spawned but failed to open a public HTTPS tunnel within 7.5 seconds.")
    except Exception as e:
        logger.error(f"Error launching background ngrok subprocess: {e}", exc_info=True)

    return None

async def run_meta_auto_configuration() -> None:
    """
    Performs auto-webhook registration on the Meta Graph API.
    Runs asynchronously with a delay to allow the Uvicorn port listener to start first,
    ensuring Meta's synchronous verification GET requests succeed.
    """
    settings = get_settings()
    
    # Check if either setup trigger is active
    is_enabled = settings.AUTO_CONFIGURE_META or settings.REGISTER_META_WEBHOOK
    if not is_enabled:
        logger.info("Auto Meta Webhook configuration is disabled.")
        return

    # Wait for the Uvicorn port listener to bind and begin listening
    logger.info("Lifespan setup: Waiting 5 seconds for Uvicorn listener to boot...")
    await asyncio.sleep(5.0)

    # 1. Resolve target callback URL
    callback_url = ""
    if settings.USE_NGROK:
        logger.info("USE_NGROK is active. Resolving/launching tunnel...")
        public_url = await ensure_ngrok_running()
        if public_url:
            callback_url = f"{public_url.rstrip('/')}/webhook"
            logger.info(f"Resolved callback URL via ngrok: {callback_url}")
        else:
            logger.warning("Dynamic ngrok setup failed. Falling back to PUBLIC_URL.")

    if not callback_url and settings.PUBLIC_URL:
        callback_url = f"{settings.PUBLIC_URL.rstrip('/')}/webhook"
        logger.info(f"Using configured PUBLIC_URL callback: {callback_url}")

    if not callback_url:
        logger.error(
            "Auto Meta webhook registration aborted: "
            "Neither ngrok nor PUBLIC_URL could be resolved."
        )
        return

    # 2. Check essential parameters
    if not settings.APP_ID or not settings.APP_SECRET:
        logger.error("Auto Meta webhook registration aborted: APP_ID or APP_SECRET is missing.")
        return
    if not settings.VERIFY_TOKEN:
        logger.error("Auto Meta webhook registration aborted: VERIFY_TOKEN is missing.")
        return

    # 3. Step A: Register Callback URI and Verify Token at the App Level
    app_token = f"{settings.APP_ID}|{settings.APP_SECRET}"
    url = f"https://graph.facebook.com/{settings.GRAPH_VERSION}/{settings.APP_ID}/subscriptions"
    
    payload = {
        "object": "whatsapp_business_account",
        "callback_url": callback_url,
        "verify_token": settings.VERIFY_TOKEN,
        "fields": "messages",
        "include_values": "true",
        "access_token": app_token
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            logger.info(f"Registering callback URL with Meta App: {callback_url}")
            resp = await client.post(url, data=payload)
            
            if resp.status_code == 200:
                logger.info("Successfully registered webhook callback URI with Meta App!")
            else:
                logger.error(
                    f"Meta App Webhook registration failed. Status={resp.status_code}, Response={resp.text}"
                )
                return

            # 4. Step B: Programmatically subscribe the app to WABA events (if WABA_ID & Token exist)
            if settings.WABA_ID and settings.ACCESS_TOKEN:
                logger.info(f"Subscribing Meta App to WABA ID: {settings.WABA_ID}...")
                waba_url = f"https://graph.facebook.com/{settings.GRAPH_VERSION}/{settings.WABA_ID}/subscribed_apps"
                waba_headers = {"Authorization": f"Bearer {settings.ACCESS_TOKEN}"}
                
                waba_resp = await client.post(waba_url, headers=waba_headers)
                if waba_resp.status_code == 200:
                    logger.info(f"App successfully subscribed to receive WABA ID {settings.WABA_ID} notifications.")
                else:
                    logger.error(
                        f"WABA app-subscription endpoint failed. Status={waba_resp.status_code}, Response={waba_resp.text}"
                    )
            else:
                logger.info("WABA_ID or ACCESS_TOKEN not provided. Skipping WABA-level app subscription.")

    except Exception as e:
        logger.error(f"Unexpected network or schema exception in Auto Meta setup: {e}", exc_info=True)
