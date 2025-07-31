import { NextRequest, NextResponse } from 'next/server';

// 全局变量存储当前街景邻近链接
let currentLinks: Array<{
  panoId: string;
  heading: number;
  description: string;
}> | null = null;

export async function GET() {
  // 获取当前街景邻近链接
  if (!currentLinks) {
    return NextResponse.json({ error: 'No street view links available' }, { status: 404 });
  }
  
  return NextResponse.json({ 
    success: true,
    links: currentLinks,
    count: currentLinks.length,
    timestamp: new Date().toISOString() 
  });
}

export async function POST(request: NextRequest) {
  try {
    // 更新当前街景邻近链接
    const body = await request.json();
    const { links } = body;
    
    if (!Array.isArray(links)) {
      return NextResponse.json({ error: 'Invalid links data' }, { status: 400 });
    }
    
    currentLinks = links;
    console.log('🔗 Street view links updated, count:', links.length);
    
    return NextResponse.json({ 
      success: true,
      count: links.length,
      timestamp: new Date().toISOString() 
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse request body' }, { status: 400 });
  }
}

// 获取当前链接的函数（供服务器端调用）
export function getCurrentLinks() {
  return currentLinks;
}