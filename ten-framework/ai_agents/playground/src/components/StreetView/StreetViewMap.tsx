"use client";

import { useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface StreetViewMapProps {
  className?: string;
}

export default function StreetViewMap({ className }: StreetViewMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyBX1tyMdVh62Z_h7Snbs9A8DnQcHbhPoGs",
  });
  
  const panoramaRef = useRef<HTMLDivElement>(null);
  const panorama = useRef<google.maps.StreetViewPanorama | null>(null);
  const [links, setLinks] = useState<google.maps.StreetViewLink[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [visitedPanos, setVisitedPanos] = useState<Set<string>>(new Set());
  const [currentPanoId, setCurrentPanoId] = useState<string>("");

  // Function to check for AI control commands
  const checkAIControlCommand = async () => {
    try {
      const response = await fetch('/api/streetview-control', {
        method: 'GET'
      });
      
      if (!response.ok) {
        return;
      }
      
      const data = await response.json();
      if (data.command) {
        const { action, panoId, heading } = data.command;
        
        if (action === 'moveToLocation' && panoId) {
          console.log(`🤖 Executing AI command: Move to ${panoId} with heading ${heading}`);
          moveToLocation(panoId, heading);
        }
      }
      
    } catch (error) {
      // 静默处理错误
    }
  };

  // Function to get and update street view image
  const updateStreetViewImage = async () => {
    if (!panorama.current) {
      console.error('Panorama not initialized');
      return;
    }

    try {
      const currentPanoId = panorama.current.getPano();
      const currentPov = panorama.current.getPov();

      if (!currentPanoId) {
        console.error('No pano ID available');
        return;
      }

      console.log(`🖼️ Getting street view image for pano: ${currentPanoId}, heading: ${currentPov.heading}`);

      const apiKey = "AIzaSyBX1tyMdVh62Z_h7Snbs9A8DnQcHbhPoGs";
      const staticImageUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&pano=${currentPanoId}&heading=${currentPov.heading || 0}&pitch=${currentPov.pitch || 0}&fov=90&key=${apiKey}`;

      const response = await fetch(staticImageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch street view image: ${response.status}`);
      }

      const blob = await response.blob();
      
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          console.log(`✅ Successfully got street view image, size: ${result.length} characters`);
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // 推送图片到API端点
      try {
        await fetch('/api/current-streetview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: base64Image })
        });
        console.log('📤 Street view image pushed to API');
      } catch (apiError) {
        console.error('Failed to push image to API:', apiError);
      }

    } catch (error) {
      console.error('Failed to get street view image:', error);
    }
  };

  useEffect(() => {
    if (isLoaded && panoramaRef.current) {
      panorama.current = new window.google.maps.StreetViewPanorama(
        panoramaRef.current,
        {
          position: { lat: 36.1147, lng: -115.1728 }, // Las Vegas default
          pov: { heading: 0, pitch: 0 },
          zoom: 1,
          addressControlOptions: {
            position: google.maps.ControlPosition.TOP_RIGHT,
          },
          linksControl: false,
          panControl: false,
          enableCloseButton: false,
          fullscreenControl: false,
        }
      );

      // Listen for panorama changes
      panorama.current.addListener('pano_changed', () => {
        const newPanoId = panorama.current?.getPano();
        if (newPanoId) {
          console.log('Street view location changed to:', newPanoId);
          setCurrentPanoId(newPanoId);
          
          // Add new location to visited history
          setVisitedPanos(prev => new Set([...prev, newPanoId]));
          
          // Update available links after position loads
          setTimeout(updateLinksForCurrentPosition, 500);
          
          // Update street view image after position change
          setTimeout(updateStreetViewImage, 1000);
        }
      });

      // Initial load of adjacent locations
      panorama.current.addListener('pano_changed', () => {
        setTimeout(() => {
          if (links.length === 0) {
            updateLinksForCurrentPosition();
          }
        }, 1000);
      });

      // 暴露全局控制方法供代理服务器调用
      (window as any).streetViewControls = {
        moveToLocation: (panoId: string, heading: number = 0) => {
          console.log(`🎯 External command: Move to ${panoId} with heading ${heading}`);
          moveToLocation(panoId, heading);
        },
        getCurrentInfo: () => {
          const currentPanoId = panorama.current?.getPano();
          const currentPov = panorama.current?.getPov();
          const availableLinks = links.map(link => ({
            panoId: link.pano!,
            heading: link.heading || 0,
            description: link.description || ''
          }));
          return {
            currentPanoId,
            currentPov,
            availableLinks
          };
        }
      };

      // 暴露AI控制方法到全局，供 proxy server 直接调用
      (window as any).aiNavigationCommand = (panoId: string, heading: number = 0) => {
        console.log(`🤖 AI Navigation Command: Move to ${panoId} with heading ${heading}`);
        moveToLocation(panoId, heading);
      };

      // 定期检查AI控制命令
      const aiCommandInterval = setInterval(checkAIControlCommand, 500);
      
      // 清理函数
      return () => {
        clearInterval(aiCommandInterval);
      };

      // Expose global method for external access
      (window as any).getCurrentStreetViewImage = updateStreetViewImage;

      // 初始加载时获取图片和链接
      setTimeout(() => {
        updateStreetViewImage();
        updateLinksForCurrentPosition();
      }, 2000);
    }
  }, [isLoaded]);

  const updateLinksForCurrentPosition = () => {
    const allLinks = panorama.current?.getLinks()?.filter(link => link !== null) || [];
    // Filter out already visited locations
    const unvisitedLinks = allLinks.filter(link =>
      link?.pano && !visitedPanos.has(link.pano)
    );

    // Sort links by current view direction
    const sortedLinks = sortLinksByDirection(unvisitedLinks as google.maps.StreetViewLink[]);
    
    setLinks(sortedLinks);
    console.log(`Updated links for new position: ${allLinks.length} directions, ${unvisitedLinks.length} unvisited`);

    // 推送邻近链接到API端点供AI使用
    const linksForAI = sortedLinks.map(link => ({
      panoId: link.pano!,
      heading: link.heading || 0,
      description: link.description || ''
    }));

    fetch('/api/current-links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ links: linksForAI })
    }).then(() => {
      console.log('🔗 Street view links pushed to API, count:', linksForAI.length);
    }).catch(error => {
      console.error('Failed to push links to API:', error);
    });

    if (unvisitedLinks.length === 0 && allLinks.length > 0) {
      console.log("All adjacent locations have been visited!");
    }
  };

  const sortLinksByDirection = (links: google.maps.StreetViewLink[]): google.maps.StreetViewLink[] => {
    if (!panorama.current) return links;
    
    const currentPov = panorama.current.getPov();
    const currentHeading = currentPov.heading || 0;
    
    return links.sort((a, b) => {
      const aHeading = a.heading || 0;
      const bHeading = b.heading || 0;
      
      const aDistance = Math.abs(((aHeading - currentHeading + 540) % 360) - 180);
      const bDistance = Math.abs(((bHeading - currentHeading + 540) % 360) - 180);
      
      return aDistance - bDistance;
    });
  };

  const moveToLocation = async (panoId: string, heading: number): Promise<void> => {
    if (!panorama.current || isTransitioning) return;

    setIsTransitioning(true);
    console.log(`Moving to: ${panoId} with heading: ${heading}`);

    try {
      // Step 1: Turn towards target direction
      const currentPov = panorama.current.getPov();
      await animateHeading(currentPov.heading!, heading);

      // Step 2: Add fade effect
      const panoramaElement = panoramaRef.current;
      if (panoramaElement) {
        panoramaElement.style.transition = 'opacity 0.3s ease-in-out';
        panoramaElement.style.opacity = '0.3';
      }

      // Step 3: Wait before switching location
      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 4: Switch to new location
      panorama.current.setPano(panoId);

      // Step 5: Wait for new location to load  
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 6: Restore opacity
      if (panoramaElement) {
        panoramaElement.style.opacity = '1';
        setTimeout(() => {
          panoramaElement.style.transition = '';
        }, 300);
      }

      // Step 7: Update links for new position
      await new Promise(resolve => setTimeout(resolve, 100));
      updateLinksForCurrentPosition();

    } catch (error) {
      console.error('Transition animation error:', error);
    } finally {
      setIsTransitioning(false);
    }
  };

  const animateHeading = (fromHeading: number, toHeading: number): Promise<void> => {
    return new Promise((resolve) => {
      const duration = 800;
      const startTime = Date.now();

      // Handle angle difference (choose shortest path)
      let angleDiff = toHeading - fromHeading;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Use easing function for smoother animation
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const currentHeading = fromHeading + (angleDiff * easeProgress);

        if (panorama.current) {
          const currentPov = panorama.current.getPov();
          panorama.current.setPov({
            ...currentPov,
            heading: currentHeading
          });
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  };

  const jumpToPano = (panoId: string, description: string, heading?: number) => {
    console.log("🎯 jumpToPano called with:", { panoId, description, heading });
    const targetHeading = heading || 0;
    console.log("🎯 Calling moveToLocation with:", { panoId, targetHeading, description });
    moveToLocation(panoId, targetHeading);
  };

  const resetVisitedHistory = () => {
    setVisitedPanos(new Set([currentPanoId])); // Keep current position
    updateLinksForCurrentPosition();
    console.log("Visit history reset");
  };

  const getLinksInfo = () => {
    const currentLinks = panorama.current?.getLinks()?.filter(link => link !== null) || [];
    setLinks(currentLinks as google.maps.StreetViewLink[]);
    console.log("Adjacent links for current position:");
    currentLinks.forEach((link, index) => {
      console.log(`${index + 1}. Direction: ${link?.description}, ID: ${link?.pano}`);
    });
  };

  const getDirectionLabel = (currentHeading: number, targetHeading: number): string => {
    const normalizedDiff = ((targetHeading - currentHeading + 540) % 360) - 180;
    
    if (normalizedDiff >= -22.5 && normalizedDiff < 22.5) return "前方";
    if (normalizedDiff >= 22.5 && normalizedDiff < 67.5) return "右前";
    if (normalizedDiff >= 67.5 && normalizedDiff < 112.5) return "右侧";
    if (normalizedDiff >= 112.5 && normalizedDiff < 157.5) return "右后";  
    if (normalizedDiff >= 157.5 || normalizedDiff < -157.5) return "后方";
    if (normalizedDiff >= -157.5 && normalizedDiff < -112.5) return "左后";
    if (normalizedDiff >= -112.5 && normalizedDiff < -67.5) return "左侧";
    if (normalizedDiff >= -67.5 && normalizedDiff < -22.5) return "左前";
    
    return "未知";
  };

  // Generate street view static image URL for previews
  const getStreetViewImageUrl = (panoId: string, heading: number = 0) => {
    const apiKey = "AIzaSyBX1tyMdVh62Z_h7Snbs9A8DnQcHbhPoGs";
    return `https://maps.googleapis.com/maps/api/streetview?size=200x150&pano=${panoId}&heading=${heading}&pitch=0&key=${apiKey}`;
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Street View Panorama */}
      <div ref={panoramaRef} className="flex-1 min-h-[400px]" />
      
      {/* Controls */}
      <div className="flex flex-col gap-4 p-4 bg-[#181a1d] text-white max-h-60 overflow-y-auto">
        {/* Button Group */}
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={getLinksInfo}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
          >
            Refresh Links
          </button>
          <button 
            onClick={resetVisitedHistory}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
          >
            Reset History
          </button>
        </div>

        {/* Stats */}
        <div className="text-sm text-gray-300">
          <span>Visited: {visitedPanos.size} locations</span>
        </div>

        {/* Navigation Links */}
        {links.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Available Directions ({links.length}):</h4>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              {links.map((link, index) => {
                const currentPov = panorama.current?.getPov();
                const currentHeading = currentPov?.heading || 0;
                const targetHeading = link.heading || 0;
                const directionLabel = getDirectionLabel(currentHeading, targetHeading);

                return (
                  <button
                    key={link.pano}
                    onClick={() => jumpToPano(link.pano!, link.description!, link.heading || 0)}
                    disabled={isTransitioning}
                    className={cn(
                      "flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden relative transition-all duration-200",
                      "bg-gray-700 hover:bg-gray-600 border-2",
                      {
                        "border-blue-500": !isTransitioning,
                        "border-gray-500 opacity-50 cursor-not-allowed": isTransitioning,
                      }
                    )}
                  >
                    <img
                      src={getStreetViewImageUrl(link.pano!, link.heading || 0)}
                      alt={`Direction: ${link.description}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-2">
                      <div className="text-xs text-white font-medium truncate">
                        {directionLabel}
                      </div>
                      <div className="text-xs text-gray-300 truncate">
                        {link.description || `方向 ${index + 1}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400">
            No navigation options available. Try refreshing or moving to a different location.
          </div>
        )}
      </div>
    </div>
  );
}