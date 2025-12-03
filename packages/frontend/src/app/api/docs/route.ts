import { readFileSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const content = readFileSync(
      join(process.cwd(), '../../docs/README.md'),
      'utf-8'
    );
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { content: '# Documentation\n\nWelcome to the Construction Pricing Platform documentation.' },
      { status: 200 }
    );
  }
}











