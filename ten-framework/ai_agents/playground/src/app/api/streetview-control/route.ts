import { NextRequest, NextResponse } from 'next/server';

// 全局变量存储控制命令
let currentCommand: { action: string; panoId: string; heading: number; timestamp: number } | null = null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, panoId, heading } = body;
    
    if (action !== 'moveToLocation') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    if (!panoId) {
      return NextResponse.json({ error: 'Missing panoId' }, { status: 400 });
    }
    
    console.log(`🎯 Street view control command received: ${action} to ${panoId} with heading ${heading || 0}`);
    
    // 存储控制命令
    currentCommand = {
      action,
      panoId,
      heading: heading || 0,
      timestamp: Date.now()
    };
    
    return NextResponse.json({ 
      success: true, 
      action,
      panoId,
      heading: heading || 0,
      timestamp: new Date().toISOString() 
    });
    
  } catch (error) {
    console.error('❌ Street view control error:', error);
    return NextResponse.json({ error: 'Failed to process control command' }, { status: 400 });
  }
}

export async function GET() {
  // 返回当前控制命令并清空
  const command = currentCommand;
  currentCommand = null;
  
  if (!command) {
    return NextResponse.json({ success: true, command: null });
  }
  
  return NextResponse.json({ 
    success: true,
    command,
    timestamp: new Date().toISOString() 
  });
}