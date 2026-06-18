import json
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar
from uuid import UUID

from models import BaseEntity

from .exceptions import EntityNotFoundError

T = TypeVar("T", bound=BaseEntity)


class Repository(ABC, Generic[T]):
    @abstractmethod
    def add(self, entity: T) -> T: ...

    @abstractmethod
    def get(self, entity_id: UUID) -> Optional[T]: ...

    @abstractmethod
    def list(self) -> List[T]: ...

    @abstractmethod
    def update(self, entity: T) -> T: ...

    @abstractmethod
    def delete(self, entity_id: UUID) -> None: ...

    @abstractmethod
    def filter(self, **kwargs: Any) -> List[T]: ...


class JSONRepository(Repository[T]):
    def __init__(self, entity_class: Type[T], file_path: Path):
        self.entity_class = entity_class
        self.file_path = file_path
        self._data: Dict[UUID, T] = {}
        self._load()

    def _load(self) -> None:
        if not self.file_path.exists():
            self._data = {}
            return
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
            self._data = {
                UUID(item["id"]): self.entity_class(**item)
                for item in raw_data
            }
        except (json.JSONDecodeError, KeyError):
            self._data = {}

    def _save(self) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        serializable = [
            json.loads(entity.model_dump_json())
            for entity in self._data.values()
        ]
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(serializable, f, indent=2, ensure_ascii=False)

    def add(self, entity: T) -> T:
        entity.save()
        self._data[entity.id] = entity
        self._save()
        return entity

    def get(self, entity_id: UUID) -> Optional[T]:
        return self._data.get(entity_id)

    def list(self) -> List[T]:
        return list(self._data.values())

    def update(self, entity: T) -> T:
        if entity.id not in self._data:
            raise EntityNotFoundError(self.entity_class.__name__, str(entity.id))
        entity.save()
        self._data[entity.id] = entity
        self._save()
        return entity

    def delete(self, entity_id: UUID) -> None:
        if entity_id not in self._data:
            raise EntityNotFoundError(self.entity_class.__name__, str(entity_id))
        del self._data[entity_id]
        self._save()

    def filter(self, **kwargs: Any) -> List[T]:
        results = []
        for entity in self._data.values():
            match = True
            for key, value in kwargs.items():
                entity_value = getattr(entity, key, None)
                if isinstance(value, list):
                    if entity_value not in value:
                        match = False
                        break
                else:
                    if entity_value != value:
                        match = False
                        break
            if match:
                results.append(entity)
        return results
