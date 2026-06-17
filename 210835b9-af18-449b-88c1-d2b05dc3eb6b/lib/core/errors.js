class MigrationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'MigrationError';
    this.code = code;
    this.details = details;
    this.suggestion = this._getSuggestion(code);
  }

  _getSuggestion(code) {
    const suggestions = {
      CONFIG_NOT_FOUND: 'Run "db-migrate init" to create the configuration file.',
      CONFIG_PARSE_ERROR: 'Check the YAML/JSON syntax in your configuration file.',
      INVALID_DRIVER: 'Supported drivers: mysql, postgresql, sqlite.',
      CONNECTION_FAILED: 'Verify database credentials and ensure the database server is running.',
      MIGRATION_NOT_FOUND: 'Check the migration directory path in your configuration.',
      MIGRATION_SYNTAX_ERROR: 'Verify the migration script exports valid up() and down() functions.',
      VERSION_CONFLICT: 'Resolve version conflicts by renaming migration files or adjusting timestamps.',
      ROLLBACK_FAILED: 'Check the down() function in the migration script.',
      TRANSACTION_FAILED: 'The current migration was rolled back. Fix the script and retry.',
      DIRECTORY_NOT_FOUND: 'Create the migration directory or update the path in configuration.',
      FILE_NAME_CONFLICT: 'Rename the migration file to use a unique timestamp.',
      VALIDATION_ERROR: 'Review the error details and correct the invalid parameter.',
      QUERY_FAILED: 'Check the SQL syntax in your migration script.',
      VERSION_TABLE_CREATE_FAILED: 'Ensure the database user has CREATE TABLE permissions.',
      PERMISSION_DENIED: 'Check database user permissions for the required operations.',
    };
    return suggestions[code] || 'Review the error details and consult the documentation.';
  }
}

class DatabaseError extends MigrationError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'DatabaseError';
  }
}

class ValidationError extends MigrationError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'ValidationError';
  }
}

module.exports = { MigrationError, DatabaseError, ValidationError };
