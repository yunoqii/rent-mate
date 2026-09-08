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

export { AppError, EmailAlreadyExistsError };