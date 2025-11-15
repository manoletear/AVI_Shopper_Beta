import { NextResponse } from 'next/server';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export function successResponse<T>(data: T, status = 200, meta?: ApiResponse['meta']) {
  return NextResponse.json(
    {
      success: true,
      data,
      meta,
    } as ApiResponse<T>,
    { status }
  );
}

export function errorResponse(
  message: string,
  status = 500,
  code?: string
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code,
      },
    } as ApiResponse,
    { status }
  );
}

export function createdResponse<T>(data: T) {
  return successResponse(data, 201);
}

export function noContentResponse() {
  return new NextResponse(null, { status: 204 });
}
