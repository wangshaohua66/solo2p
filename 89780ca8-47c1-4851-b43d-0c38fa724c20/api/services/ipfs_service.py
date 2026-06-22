"""
IPFS Service with real Pinata/Infura support and automatic fallback to MockIPFS.

Environment variables:
  - PINATA_API_KEY / PINATA_SECRET: Use Pinata Cloud (https://api.pinata.cloud)
  - IPFS_GATEWAY_URL: Custom read gateway (default: https://ipfs.io/ipfs/)
  - If no env vars are set, automatically falls back to MockIPFS (local in-memory)
"""
import os
import json
import hashlib
import logging
from typing import Optional

import httpx

from api.mock_ipfs import MockIPFS, get_ipfs as get_mock_ipfs

logger = logging.getLogger(__name__)

PINATA_API_BASE = "https://api.pinata.cloud"
DEFAULT_GATEWAY = "https://ipfs.io/ipfs/"
HTTP_TIMEOUT = 10.0


class IPFSService:
    """IPFS service that uses real Pinata/Infura when configured, else MockIPFS."""

    def __init__(self):
        self._mock: Optional[MockIPFS] = None
        self._pinata_key = os.environ.get("PINATA_API_KEY", "").strip()
        self._pinata_secret = os.environ.get("PINATA_SECRET", "").strip()
        self._gateway_url = os.environ.get("IPFS_GATEWAY_URL", DEFAULT_GATEWAY).strip()
        if not self._gateway_url.endswith("/"):
            self._gateway_url += "/"

        self._use_pinata = bool(self._pinata_key and self._pinata_secret)
        if not self._use_pinata:
            logger.warning(
                "PINATA_API_KEY / PINATA_SECRET not set — using MockIPFS fallback."
            )
            self._mock = get_mock_ipfs()

    def _fallback_cid(self, data: bytes) -> str:
        """Generate a CID-formatted string locally (SHA256 prefix)."""
        sha256_hash = hashlib.sha256(data).hexdigest()
        return f"Qm{sha256_hash[:44]}"

    def get_gateway_url(self, cid: str) -> str:
        """Return the public gateway URL for a given CID."""
        return f"{self._gateway_url}{cid}"

    async def upload_file(self, data: bytes, filename: str = "file.bin") -> str:
        """Upload bytes to IPFS, return CID. Fallback to mock / local hash."""
        if not self._use_pinata:
            if self._mock:
                return self._mock.add_bytes(data)
            return self._fallback_cid(data)

        try:
            headers = {
                "pinata_api_key": self._pinata_key,
                "pinata_secret_api_key": self._pinata_secret,
            }
            files = {"file": (filename, data, "application/octet-stream")}
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                resp = await client.post(
                    f"{PINATA_API_BASE}/pinning/pinFileToIPFS",
                    headers=headers,
                    files=files,
                )
                resp.raise_for_status()
                payload = resp.json()
                cid = payload.get("IpfsHash") or payload.get("Hash")
                if not cid:
                    raise ValueError("Pinata response missing IpfsHash")
                return cid
        except Exception as exc:
            logger.error("Pinata upload_file failed, fallback to mock: %s", exc)
            if self._mock:
                return self._mock.add_bytes(data)
            return self._fallback_cid(data)

    async def upload_json(self, data: dict, filename: str = "metadata.json") -> str:
        """Upload a JSON dict to IPFS, return CID."""
        json_bytes = json.dumps(data, sort_keys=True, ensure_ascii=False).encode("utf-8")
        return await self.upload_file(json_bytes, filename)

    async def cat(self, cid: str) -> bytes:
        """Retrieve raw bytes for a CID. Fallback to mock or empty bytes."""
        if not self._use_pinata:
            if self._mock:
                return self._mock.cat(cid)
            return b""

        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True) as client:
                resp = await client.get(self.get_gateway_url(cid))
                if resp.status_code == 200:
                    return resp.content
        except Exception as exc:
            logger.error("Gateway cat failed, fallback to mock: %s", exc)

        if self._mock:
            return self._mock.cat(cid)
        return b""

    async def get_json(self, cid: str) -> dict:
        """Retrieve and parse JSON for a CID."""
        raw = await self.cat(cid)
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            logger.error("Failed to decode JSON from CID %s: %s", cid, exc)
            return {}


ipfs_service = IPFSService()
