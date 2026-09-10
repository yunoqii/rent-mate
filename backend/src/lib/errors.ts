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
    constructor() {
        super("Invalid data provided", 400);
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

export {
    AppError, EmailAlreadyExistsError,
    InvalidDataProvidedError, InvalidCredentialsError,
    UnauthorizedError
};
