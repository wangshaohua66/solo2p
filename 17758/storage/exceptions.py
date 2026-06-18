class StorageError(Exception):
    pass


class EntityNotFoundError(StorageError):
    def __init__(self, entity_type: str, entity_id: str):
        super().__init__(f"{entity_type} with id {entity_id} not found")
        self.entity_type = entity_type
        self.entity_id = entity_id


class DuplicateEntityError(StorageError):
    def __init__(self, entity_type: str, field: str, value: str):
        super().__init__(f"{entity_type} with {field}={value} already exists")
        self.entity_type = entity_type
        self.field = field
        self.value = value


class ValidationError(StorageError):
    pass


class ConfigError(StorageError):
    pass
