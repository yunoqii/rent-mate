class AppError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
    }
}

class EmailAlreadyExistsError extends AppError {
    constructor() {
        super("User with this email already exists", 409);
    }
}

class InvalidDataProvidedError extends AppError {
    constructor(message: string = "Invalid data provided") {
        super(message, 400);
    }
}

class InvalidCredentialsError extends AppError {
    constructor() {
        super("Invalid email or password", 401);
    }
}

class UnauthorizedError extends AppError {
    constructor(message: string = "Unauthorized") {
        super(message, 401);
    }
}

class ForbiddenError extends AppError {
    constructor(message: string = "Forbidden") {
        super(message, 403);
    }
}

class NotFoundError extends AppError {
    constructor(message: string = "Not found") {
        super(message, 404);
    }
}

// Request is valid, but conflicts with the current state of the data
class ConflictError extends AppError {
    constructor(message: string = "Conflict") {
        super(message, 409);
    }
}

// An external dependency (LLM provider) is not available
class ServiceUnavailableError extends AppError {
    constructor(message: string = "Service unavailable") {
        super(message, 503);
    }
}

export {
    AppError, EmailAlreadyExistsError,
    InvalidDataProvidedError, InvalidCredentialsError,
    UnauthorizedError, ForbiddenError, NotFoundError,
    ConflictError, ServiceUnavailableError,
};
