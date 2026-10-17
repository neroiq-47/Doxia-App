import { NextResponse } from 'next/server';
export function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } }); }
export function jsonOk<T extends Record<string, unknown>>(data: T, status = 200) { return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function safeString(value: unknown, max: number): string | null { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null; }
