import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';

type ErrorResponse = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status: (statusCode: number) => { json: (body: ErrorResponse) => void };
    }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(this.normalizeHttpBody(status, body));
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.message : 'Unhandled exception',
      exception instanceof Error ? exception.stack : undefined
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error'
    });
  }

  private normalizeHttpBody(status: number, body: string | object): ErrorResponse {
    if (typeof body === 'string') {
      return {
        statusCode: status,
        message: body
      };
    }

    const response = body as Partial<ErrorResponse>;
    return {
      statusCode: response.statusCode ?? status,
      message: response.message ?? 'Request failed',
      error: response.error
    };
  }
}
