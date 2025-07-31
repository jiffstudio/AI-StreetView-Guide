import { NextRequest, NextResponse } from 'next/server';

// 全局变量存储当前街景图片
let currentStreetViewImage: string | null = null;

export async function GET() {
  // 获取当前街景图片
  if (!currentStreetViewImage) {
    return NextResponse.json({ error: 'No street view image available' }, { status: 404 });
  }
  
  // 解析 base64 图片并返回
  const matches = currentStreetViewImage.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
  }
  
  const imageType = matches[1];
  const imageData = matches[2];
  const buffer = Buffer.from(imageData, 'base64');
  
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': `image/${imageType}`,
      'Content-Length': buffer.length.toString(),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // 更新当前街景图片
    const body = await request.json();
    const { image } = body;
    
    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }
    
    currentStreetViewImage = image;
    console.log('📸 Street view image updated, size:', image.length);
    
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString() 
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse request body' }, { status: 400 });
  }
}

// 获取当前图片的函数（供服务器端调用）
export function getCurrentStreetViewImage(): string | null {
  return currentStreetViewImage;
}