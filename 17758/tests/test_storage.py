import pytest
from models import Contact
from storage import EntityNotFoundError, JSONRepository


class TestJSONRepository:
    def test_add_and_get(self, temp_dir):
        repo = JSONRepository(Contact, temp_dir / "contacts.json")
        contact = Contact(name="John Doe")
        added = repo.add(contact)
        fetched = repo.get(added.id)
        assert fetched is not None
        assert fetched.name == "John Doe"

    def test_list(self, temp_dir):
        repo = JSONRepository(Contact, temp_dir / "contacts.json")
        repo.add(Contact(name="John"))
        repo.add(Contact(name="Jane"))
        items = repo.list()
        assert len(items) == 2

    def test_update(self, temp_dir):
        repo = JSONRepository(Contact, temp_dir / "contacts.json")
        contact = repo.add(Contact(name="John"))
        contact.name = "John Updated"
        updated = repo.update(contact)
        assert updated.name == "John Updated"

    def test_update_nonexistent(self, temp_dir):
        repo = JSONRepository(Contact, temp_dir / "contacts.json")
        from uuid import uuid4
        contact = Contact(name="John", id=uuid4())
        with pytest.raises(EntityNotFoundError):
            repo.update(contact)

    def test_delete(self, temp_dir):
        repo = JSONRepository(Contact, temp_dir / "contacts.json")
        contact = repo.add(Contact(name="John"))
        repo.delete(contact.id)
        assert repo.get(contact.id) is None

    def test_delete_nonexistent(self, temp_dir):
        repo = JSONRepository(Contact, temp_dir / "contacts.json")
        from uuid import uuid4
        with pytest.raises(EntityNotFoundError):
            repo.delete(uuid4())

    def test_filter(self, temp_dir):
        repo = JSONRepository(Contact, temp_dir / "contacts.json")
        from models import ContactStatus
        repo.add(Contact(name="John", status=ContactStatus.POTENTIAL))
        repo.add(Contact(name="Jane", status=ContactStatus.CLOSED))
        results = repo.filter(status=ContactStatus.CLOSED)
        assert len(results) == 1
        assert results[0].name == "Jane"

    def test_persistence(self, temp_dir):
        file_path = temp_dir / "contacts.json"
        repo1 = JSONRepository(Contact, file_path)
        contact = repo1.add(Contact(name="John"))
        repo2 = JSONRepository(Contact, file_path)
        fetched = repo2.get(contact.id)
        assert fetched is not None
        assert fetched.name == "John"
