import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: 500 })
  }
}
