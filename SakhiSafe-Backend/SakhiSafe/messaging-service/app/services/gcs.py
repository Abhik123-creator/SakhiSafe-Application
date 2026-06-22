import os
import logging
import asyncio
from typing import Optional
from app.config import get_settings

logger = logging.getLogger("gcs-service")

# Gracefully handle environment where google-cloud-storage is not installed
try:
    from google.cloud import storage
    GCS_AVAILABLE = True
except ImportError:
    storage = None
    GCS_AVAILABLE = False

def _sync_upload_bytes_to_gcs(
    bucket_name: str,
    content: bytes,
    destination_blob_name: str,
    content_type: str,
    credentials_file: Optional[str] = None
) -> str:
    """
    Synchronously uploads raw bytes to a Google Cloud Storage bucket.
    """
    if not GCS_AVAILABLE or storage is None:
        raise RuntimeError("google-cloud-storage is not installed in this environment.")

    if credentials_file and os.path.exists(credentials_file):
        client = storage.Client.from_service_account_json(credentials_file)
    else:
        client = storage.Client()
        
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)
    
    logger.debug(f"Starting upload to GCS bucket '{bucket_name}' for blob '{destination_blob_name}'...")
    blob.upload_from_string(content, content_type=content_type)
    logger.info(f"Successfully uploaded blob '{destination_blob_name}' to GCS bucket '{bucket_name}'")
    
    return blob.public_url

async def upload_to_gcs(
    content: bytes,
    destination_blob_name: str,
    content_type: str
) -> Optional[str]:
    """
    Asynchronously uploads raw bytes to Google Cloud Storage using asyncio.to_thread.
    Returns the resolved public GCS object URL, or None if upload fails.
    """
    if not GCS_AVAILABLE:
        logger.error(
            "GCS upload failed: 'google-cloud-storage' package is not installed. "
            "Please run 'pip install google-cloud-storage' to enable this feature."
        )
        return None

    settings = get_settings()
    if not settings.GCS_ENABLED:
        logger.warning("GCS upload aborted: GCS_ENABLED is set to False.")
        return None
        
    if not settings.GCS_BUCKET_NAME:
        logger.error("GCS upload aborted: GCS_BUCKET_NAME is not configured in settings.")
        return None
        
    try:
        # Offload blocking synchronous GCS API calls to a worker thread
        public_url = await asyncio.to_thread(
            _sync_upload_bytes_to_gcs,
            settings.GCS_BUCKET_NAME,
            content,
            destination_blob_name,
            content_type,
            settings.GCS_CREDENTIALS_FILE if settings.GCS_CREDENTIALS_FILE else None
        )
        return public_url
    except Exception as e:
        logger.error(f"GCS upload exception for blob '{destination_blob_name}': {e}", exc_info=True)
        return None
