import hashlib
import uuid
from typing import Optional


class ChainAdapter:
    async def upload_to_ipfs(self, data: bytes, filename: str = "metadata.json") -> str:
        content_hash = hashlib.sha256(data).hexdigest()
        cid = f"Qm{content_hash[:44]}"
        return cid

    async def register_copyright(
        self,
        collection_id: int,
        token_id: str,
        ipfs_cid: str,
        chain_type: str = "ethereum",
        metadata_hash: str = "",
    ) -> dict:
        if chain_type == "ethereum":
            return await self._register_ethereum(collection_id, token_id, ipfs_cid, metadata_hash)
        elif chain_type == "antchain":
            return await self._register_antchain(collection_id, token_id, ipfs_cid, metadata_hash)
        else:
            raise ValueError(f"Unsupported chain type: {chain_type}")

    async def _register_ethereum(
        self, collection_id: int, token_id: str, ipfs_cid: str, metadata_hash: str
    ) -> dict:
        tx_hash = f"0x{uuid.uuid4().hex[:64]}"
        certificate_url = f"https://etherscan.io/tx/{tx_hash}"
        return {
            "chain_type": "ethereum",
            "tx_hash": tx_hash,
            "certificate_url": certificate_url,
            "contract_address": f"0x{hashlib.sha256(str(collection_id).encode()).hexdigest()[:40]}",
            "token_id": token_id,
            "ipfs_cid": ipfs_cid,
            "block_number": hash(str(uuid.uuid4())) % 10000000 + 18000000,
        }

    async def _register_antchain(
        self, collection_id: int, token_id: str, ipfs_cid: str, metadata_hash: str
    ) -> dict:
        tx_hash = uuid.uuid4().hex[:64]
        certificate_url = f"https://antchain.antgroup.com/cert/{tx_hash[:16]}"
        return {
            "chain_type": "antchain",
            "tx_hash": tx_hash,
            "certificate_url": certificate_url,
            "token_id": token_id,
            "ipfs_cid": ipfs_cid,
            "block_number": hash(str(uuid.uuid4())) % 1000000 + 5000000,
        }

    async def query_provenance(self, collection_id: int, token_id: Optional[str] = None) -> dict:
        provenance = []
        provenance.append({
            "event": "created",
            "timestamp": "2025-01-01T00:00:00Z",
            "details": f"Collection {collection_id} created",
        })
        provenance.append({
            "event": "copyright_registered",
            "timestamp": "2025-01-02T00:00:00Z",
            "details": "Copyright registered on chain",
        })
        if token_id:
            provenance.append({
                "event": "minted",
                "timestamp": "2025-01-03T00:00:00Z",
                "details": f"Token {token_id} minted",
            })
            provenance.append({
                "event": "transferred",
                "timestamp": "2025-01-04T00:00:00Z",
                "details": f"Token {token_id} transferred",
            })
        return {
            "collection_id": collection_id,
            "token_id": token_id,
            "provenance": provenance,
        }


chain_adapter = ChainAdapter()
